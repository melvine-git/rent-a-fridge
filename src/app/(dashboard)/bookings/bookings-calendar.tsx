'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import { ChevronLeft, ChevronRight, Phone, MapPin, Thermometer, Zap, CalendarSearch, ArrowUpRight, User, CalendarRange, Link2, Plus, TriangleAlert } from 'lucide-react';
import type { Booking, Unit, UnitType, CalendarView, BookingWithDetails } from '@/types';
import type { BookingListItem } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { GBP, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, powerLabel, unitDisplayStatus, type UnitDisplayStatus } from '@/lib/domain';
import { bookingRef } from '@/lib/jobs';
import { daysBetween, formatDate, formatDateRange, formatPhone, toISODate } from '@/lib/format';

interface BookingsCalendarProps {
  bookings: BookingWithDetails[];
  allUnits: Unit[];
  list: BookingListItem[];
}

const BAR_STYLES: Record<Booking['status'], string> = {
  CONFIRMED: 'bg-violet-100 text-violet-950 border-violet-500 hover:bg-violet-200/80',
  ON_HIRE: 'bg-sky-100 text-sky-950 border-sky-500 hover:bg-sky-200/80',
  COLLECTED: 'bg-stone-100 text-stone-700 border-stone-400 hover:bg-stone-200/80',
  CANCELLED: 'bg-red-50 text-red-800 border-red-400 line-through hover:bg-red-100',
};
const LATE_STYLE = 'bg-red-50 text-red-950 border-red-500 ring-1 ring-inset ring-red-300 hover:bg-red-100';

const DAY_MS = 86_400_000;

/** A unit is taken on `day` if a booking covers it; one already on hire is taken from today even if it went out early. */
export function occupies(b: Pick<Booking, 'status' | 'startDate' | 'endDate'>, day: string, today: string) {
  const start = b.status === 'ON_HIRE' && b.startDate > today ? today : b.startDate;
  return start <= day && b.endDate >= day;
}

function mondayOf(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1));
  return r;
}

export function BookingsCalendar({ bookings, allUnits, list }: BookingsCalendarProps) {
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState<BookingWithDetails | null>(null);
  const [hoverRef, setHoverRef] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [statusFilter, setStatusFilter] = useState<UnitDisplayStatus | 'ALL'>('ALL');
  const [unitTypeFilter, setUnitTypeFilter] = useState<UnitType | 'ALL'>('ALL');

  const numDays = calendarView === 'month' ? 28 : 14;
  const todayISO = toISODate(new Date());

  const days = useMemo(
    () =>
      Array.from({ length: numDays }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [anchor, numDays]
  );
  const dayISO = useMemo(() => days.map(toISODate), [days]);

  const filteredUnits = useMemo(
    () =>
      allUnits
        .filter((u) => (statusFilter === 'ALL' || unitDisplayStatus(u) === statusFilter) && (unitTypeFilter === 'ALL' || u.unitType === unitTypeFilter))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [allUnits, statusFilter, unitTypeFilter]
  );

  const bookingsByUnit = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>();
    for (const b of bookings) map.set(b.unitId, [...(map.get(b.unitId) ?? []), b]);
    return map;
  }, [bookings]);

  const groupSize = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) map.set(bookingRef(b), (map.get(bookingRef(b)) ?? 0) + 1);
    return map;
  }, [bookings]);

  // Units free each day across the filtered rows: not in service/broken and not booked that day
  const freePerDay = useMemo(() => {
    const rentable = filteredUnits.filter((u) => unitDisplayStatus(u) !== 'MAINTENANCE' && !u.breakdown);
    return dayISO.map((d) => rentable.filter((u) => !(bookingsByUnit.get(u.id) ?? []).some((b) => occupies(b, d, todayISO))).length);
  }, [dayISO, filteredUnits, bookingsByUnit, todayISO]);
  const rentableCount = filteredUnits.filter((u) => unitDisplayStatus(u) !== 'MAINTENANCE' && !u.breakdown).length;

  const counts = useMemo(
    () => ({
      ALL: allUnits.length,
      AVAILABLE: allUnits.filter((u) => unitDisplayStatus(u) === 'AVAILABLE').length,
      ON_HIRE: allUnits.filter((u) => unitDisplayStatus(u) === 'ON_HIRE').length,
      MAINTENANCE: allUnits.filter((u) => unitDisplayStatus(u) === 'MAINTENANCE').length,
      BREAKDOWN: allUnits.filter((u) => u.breakdown).length,
    }),
    [allUnits]
  );

  const shift = (dir: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * (calendarView === 'month' ? 28 : 7));
    setAnchor(d);
  };

  const todayIndex = dayISO.indexOf(todayISO);
  const colWidth = 100 / numDays;
  const isLate = (b: Booking) => (b.status === 'CONFIRMED' && b.startDate < todayISO) || (b.status === 'ON_HIRE' && b.endDate < todayISO);

  const selectedRef = selected ? bookingRef(selected) : null;
  const selectedItem = selectedRef ? list.find((l) => l.reference === selectedRef) : undefined;
  const siblings = selected ? bookings.filter((b) => bookingRef(b) === selectedRef) : [];

  return (
    <>
      <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)]">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-white">
              <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous period" className="rounded-r-none">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" onClick={() => setAnchor(mondayOf(new Date()))} className="h-8 rounded-none border-x px-3 text-[13px]">
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next period" className="rounded-l-none">
                <ChevronRight />
              </Button>
            </div>
            <h2 className="tabular min-w-[150px] px-1 text-[15px] font-semibold text-foreground">{formatDateRange(days[0], days[days.length - 1])}</h2>
            <SegmentedControl
              size="sm"
              value={calendarView}
              onChange={setCalendarView}
              ariaLabel="Range"
              options={[
                { value: 'week', label: '2 weeks' },
                { value: 'month', label: '4 weeks' },
              ]}
            />
          </div>

          <div className="scrollbar-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Unit status"
              options={[
                { value: 'ALL', label: 'All units', count: counts.ALL },
                { value: 'AVAILABLE', label: 'Available', count: counts.AVAILABLE },
                { value: 'ON_HIRE', label: 'On hire', count: counts.ON_HIRE },
                { value: 'MAINTENANCE', label: 'Service', count: counts.MAINTENANCE },
                { value: 'BREAKDOWN', label: 'Breakdown', count: counts.BREAKDOWN },
              ]}
            />
            <SegmentedControl
              size="sm"
              value={unitTypeFilter}
              onChange={setUnitTypeFilter}
              ariaLabel="Unit type"
              options={[
                { value: 'ALL', label: 'All types' },
                ...(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => {
                  const Icon = UNIT_TYPE_ICON[t];
                  return { value: t, label: <span className="hidden sm:inline">{UNIT_TYPE_LABELS[t]}</span>, icon: <Icon className="size-3.5" /> };
                }),
              ]}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="scrollbar-thin overflow-x-auto">
          <div className={cn(calendarView === 'month' ? 'min-w-[1200px]' : 'min-w-[960px]')}>
            {/* Header */}
            <div className="sticky top-0 z-20 flex border-b bg-[#FAFAF9]">
              <div className="sticky left-0 z-10 flex w-32 shrink-0 sm:w-44 items-end border-r bg-[#FAFAF9] px-4 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Unit</div>
              <div className="flex flex-1">
                {days.map((day, i) => {
                  const isToday = i === todayIndex;
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const monthStart = day.getDate() === 1 || i === 0;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'relative flex flex-1 flex-col items-center border-r py-2 last:border-r-0',
                        weekend && 'bg-muted/60',
                        isToday && 'bg-red-50/70',
                        day.getDay() === 1 && i > 0 && 'border-l border-l-border'
                      )}
                    >
                      {monthStart && <span className="absolute top-0.5 left-1.5 text-[10px] font-semibold text-muted-foreground/80 uppercase">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>}
                      <span className={cn('mt-2.5 text-[10px] font-medium uppercase', isToday ? 'text-[var(--brand-red)]' : 'text-muted-foreground')}>
                        {day.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, calendarView === 'month' ? 1 : 3)}
                      </span>
                      <span className={cn('tabular mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold', isToday ? 'bg-[var(--brand-red)] text-white' : 'text-foreground')}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Free units per day */}
            {filteredUnits.length > 0 && (
              <div className="flex border-b bg-white">
                <div className="sticky left-0 z-10 flex w-32 shrink-0 sm:w-44 flex-col justify-center border-r bg-white px-4 py-1.5">
                  <span className="text-[11px] font-semibold text-foreground">Free units</span>
                  <span className="text-[10px] text-muted-foreground">of {rentableCount} in service</span>
                </div>
                <div className="flex flex-1">
                  {freePerDay.map((n, i) => (
                    <div key={i} className={cn('flex flex-1 items-center justify-center border-r py-1.5 last:border-r-0', i === todayIndex && 'bg-red-50/50')}>
                      <span
                        className={cn(
                          'tabular min-w-6 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold',
                          n === 0 ? 'bg-red-100 text-red-700' : n <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        )}
                        title={`${n} unit${n === 1 ? '' : 's'} free on ${formatDate(dayISO[i])}`}
                      >
                        {n}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rows */}
            {filteredUnits.length === 0 ? (
              <EmptyState
                icon={CalendarSearch}
                title="No units match these filters"
                description="Try a different status or unit type."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setUnitTypeFilter('ALL');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              filteredUnits.map((unit) => {
                const inService = unit.status === 'MAINTENANCE' || !!unit.breakdown;
                return (
                  <div key={unit.id} className="group/row flex border-b last:border-b-0">
                    <Link
                      href={`/units/${unit.id}`}
                      className="sticky left-0 z-10 flex w-32 shrink-0 sm:w-44 items-center gap-3 border-r bg-white px-4 py-2 transition-colors group-hover/row:bg-[#FAFAF9]"
                    >
                      <UnitTypeIcon type={unit.unitType} boxed />
                      <div className="min-w-0">
                        <div className="font-mono-unit text-[13px] text-foreground">{unit.id}</div>
                        <div className={cn('truncate text-[11px]', unit.breakdown ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                          {unit.breakdown ? 'Breakdown' : inService ? 'In service' : UNIT_SIZE_LABELS[unit.size]}
                        </div>
                      </div>
                    </Link>
                    <div className={cn('relative flex h-14 flex-1', inService && 'bg-hatch')}>
                      {days.map((day, i) => {
                        const iso = dayISO[i];
                        const bookable = !inService && iso >= todayISO;
                        const cls = cn(
                          'group/cell flex flex-1 items-center justify-center border-r border-border/60 last:border-r-0',
                          (day.getDay() === 0 || day.getDay() === 6) && 'bg-muted/40',
                          i === todayIndex && 'bg-red-50/40',
                          day.getDay() === 1 && i > 0 && 'border-l border-l-border'
                        );
                        return bookable ? (
                          <Link key={i} href={`/bookings/new?unit=${encodeURIComponent(unit.id)}&start=${iso}`} className={cn(cls, 'hover:bg-[var(--brand-red)]/5')} aria-label={`Book ${unit.id} from ${formatDate(iso)}`} title={`Book ${unit.id} from ${formatDate(iso)}`}>
                            <Plus className="size-3.5 text-[var(--brand-red)] opacity-0 transition-opacity group-hover/cell:opacity-70" />
                          </Link>
                        ) : (
                          <div key={i} className={cls} />
                        );
                      })}
                      {todayIndex >= 0 && <div className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-[var(--brand-red)]/60" style={{ left: `${(todayIndex + 0.5) * colWidth}%` }} />}
                      {(bookingsByUnit.get(unit.id) ?? []).map((b) => {
                        const start = new Date(`${b.startDate}T00:00:00`);
                        const end = new Date(`${b.endDate}T00:00:00`);
                        const s = Math.round((start.getTime() - days[0].getTime()) / DAY_MS);
                        const e = Math.round((end.getTime() - days[0].getTime()) / DAY_MS);
                        if (e < 0 || s > numDays - 1) return null;
                        const cs = Math.max(0, s);
                        const ce = Math.min(numDays - 1, e);
                        const span = ce - cs + 1;
                        const clippedL = s < 0;
                        const clippedR = e > numDays - 1;
                        const ref = bookingRef(b);
                        const linked = (groupSize.get(ref) ?? 1) > 1;
                        const late = isLate(b);
                        const highlighted = hoverRef === ref;
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelected(b)}
                            onMouseEnter={() => setHoverRef(ref)}
                            onMouseLeave={() => setHoverRef(null)}
                            title={`${b.customer.name} · ${formatDateRange(b.startDate, b.endDate)}${linked ? ` · ${groupSize.get(ref)} units on this booking` : ''}`}
                            className={cn(
                              'absolute top-2 bottom-2 z-[6] flex min-w-0 flex-col justify-center overflow-hidden border-l-[3px] px-2 text-left shadow-[var(--shadow-xs)] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                              late ? LATE_STYLE : BAR_STYLES[b.status],
                              clippedL ? 'rounded-l-none border-l-0 pl-2.5' : 'rounded-l-md',
                              clippedR ? 'rounded-r-none' : 'rounded-r-md',
                              highlighted && 'z-[7] -translate-y-px shadow-[var(--shadow-md)] ring-2 ring-foreground/20'
                            )}
                            style={{ left: `calc(${cs * colWidth}% + 2px)`, width: `calc(${span * colWidth}% - 4px)` }}
                          >
                            <span className="flex min-w-0 items-center gap-1 text-xs leading-tight font-semibold">
                              {late && <TriangleAlert className="size-3 shrink-0 text-red-600" />}
                              <span className="truncate">{b.customer.name}</span>
                              {linked && span >= 2 && (
                                <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded bg-white/70 px-1 text-[10px] font-semibold">
                                  <Link2 className="size-2.5" />
                                  {groupSize.get(ref)}
                                </span>
                              )}
                            </span>
                            {span >= 3 && (
                              <span className="tabular truncate text-[10px] leading-tight opacity-75">
                                {late ? (b.status === 'CONFIRMED' ? `Delivery late · due ${formatDate(b.startDate)}` : `Collection overdue · ${formatDate(b.endDate)}`) : formatDateRange(b.startDate, b.endDate)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <LegendSwatch className="border-violet-500 bg-violet-100" label="Scheduled" />
          <LegendSwatch className="border-sky-500 bg-sky-100" label="On hire" />
          <LegendSwatch className="border-red-500 bg-red-50" label="Late / overdue" />
          <span className="flex items-center gap-2">
            <span className="bg-hatch h-3 w-5 rounded-sm border" /> In service
          </span>
          <span className="flex items-center gap-1.5">
            <Link2 className="size-3.5" /> Several units on one booking
          </span>
          <span className="ml-auto hidden items-center gap-1.5 sm:flex">
            <Plus className="size-3.5 text-[var(--brand-red)]" /> Click an empty day to book that unit
          </span>
        </div>
      </section>

      {/* Quick view */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono-unit text-xs text-muted-foreground">{selectedRef}</span>
                  <StatusBadge status={selectedItem?.status ?? selected.status} />
                </div>
                <SheetTitle className="mt-1 text-lg font-semibold">{selected.customer.name}</SheetTitle>
                <SheetDescription>
                  {formatDateRange(selected.startDate, selected.endDate)} · {daysBetween(selected.startDate, selected.endDate)} days
                </SheetDescription>
              </SheetHeader>
              <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {isLate(selected) && (
                  <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 ring-inset">
                    <TriangleAlert className="size-4" />
                    {selected.status === 'CONFIRMED' ? `Delivery was due ${formatDate(selected.startDate)}` : `Collection was due ${formatDate(selected.endDate)}`}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Fact label="Delivery" value={formatDate(selected.startDate, { year: true })} sub={selected.deliveryTime} />
                  <Fact label="Collection" value={formatDate(selected.endDate, { year: true })} sub={selected.collectionTime} />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">{siblings.length > 1 ? `${siblings.length} units on this booking` : 'Unit'}</div>
                  <ul className="divide-y rounded-lg border">
                    {siblings.map((s) => (
                      <li key={s.id} className={cn('flex items-center gap-3 px-3 py-2', s.id === selected.id && 'bg-muted/40')}>
                        <UnitTypeIcon type={s.unit.unitType} />
                        <span className="font-mono-unit text-[13px] text-foreground">{s.unit.id}</span>
                        <span className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[s.unit.unitType]}</span>
                        <span className="tabular ml-auto text-xs text-muted-foreground">{formatDateRange(s.startDate, s.endDate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <dl className="divide-y rounded-lg border text-sm">
                  <Row icon={<User className="size-4 text-muted-foreground" />} label="Site contact">
                    {selected.contactName}
                  </Row>
                  <Row icon={<Phone className="size-4 text-muted-foreground" />} label="Phone">
                    <a href={`tel:${selected.contactPhone}`} className="text-foreground hover:underline">
                      {formatPhone(selected.contactPhone)}
                    </a>
                  </Row>
                  <Row icon={<MapPin className="size-4 text-muted-foreground" />} label="Address">
                    {selected.deliveryAddress}
                  </Row>
                  <Row icon={<Thermometer className="size-4 text-muted-foreground" />} label="Temperature">
                    {selected.tempRequired}°C
                  </Row>
                  <Row icon={<Zap className="size-4 text-muted-foreground" />} label="Power">
                    {powerLabel(selected)}
                  </Row>
                </dl>
                {selectedItem && (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">Quoted total{selectedItem.poNumber ? ` · PO ${selectedItem.poNumber}` : ''}</span>
                    <span className="tabular font-semibold text-foreground">{selectedItem.total !== null ? GBP.format(selectedItem.total) : 'Not priced'}</span>
                  </div>
                )}
                {selected.notes && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Notes</div>
                    <p className="rounded-lg bg-muted/60 p-3 text-sm text-foreground">{selected.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t px-5 py-4">
                <Link
                  href={`/bookings/${selectedRef}`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--brand-red)] text-sm font-medium text-white hover:bg-[var(--brand-red-dark)]"
                >
                  Open booking <ArrowUpRight className="size-4" />
                </Link>
                <Link href={`/customers/${selected.customerId}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted">
                  <CalendarRange className="size-4" /> Customer
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('h-3 w-5 rounded-sm border-l-[3px]', className)} /> {label}
    </span>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
      {sub && <div className="tabular text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  );
}
