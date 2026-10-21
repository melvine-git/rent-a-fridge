'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Thermometer,
  Zap,
  CalendarSearch,
  ArrowUpRight,
  User,
  CalendarRange,
} from 'lucide-react';
import type { Booking, Unit, UnitStatus, UnitType, CalendarView, BookingWithDetails } from '@/types';
import { cn } from '@/lib/utils';
import { POWER_LABELS, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, formatDate, formatDateRange, formatPhone, toISODate } from '@/lib/format';

interface BookingsCalendarProps {
  bookings: BookingWithDetails[];
  allUnits: Unit[];
}

const BAR_STYLES: Record<Booking['status'], string> = {
  CONFIRMED: 'bg-violet-100 text-violet-900 border-violet-500 hover:bg-violet-200/80',
  ON_HIRE: 'bg-sky-100 text-sky-900 border-sky-500 hover:bg-sky-200/80',
  COLLECTED: 'bg-stone-100 text-stone-700 border-stone-400 hover:bg-stone-200/80',
};

const DAY_MS = 86_400_000;

function mondayOf(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1));
  return r;
}

export function BookingsCalendar({ bookings, allUnits }: BookingsCalendarProps) {
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState<BookingWithDetails | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'ALL'>('ALL');
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

  const filteredUnits = useMemo(
    () =>
      allUnits
        .filter((u) => (statusFilter === 'ALL' || u.status === statusFilter) && (unitTypeFilter === 'ALL' || u.unitType === unitTypeFilter))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [allUnits, statusFilter, unitTypeFilter]
  );

  const bookingsByUnit = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>();
    for (const b of bookings) map.set(b.unitId, [...(map.get(b.unitId) ?? []), b]);
    return map;
  }, [bookings]);

  const counts = useMemo(
    () => ({
      ALL: allUnits.length,
      AVAILABLE: allUnits.filter((u) => u.status === 'AVAILABLE').length,
      ON_HIRE: allUnits.filter((u) => u.status === 'ON_HIRE').length,
      MAINTENANCE: allUnits.filter((u) => u.status === 'MAINTENANCE').length,
    }),
    [allUnits]
  );

  const shift = (dir: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * (calendarView === 'month' ? 28 : 7));
    setAnchor(d);
  };

  const todayIndex = days.findIndex((d) => toISODate(d) === todayISO);
  const colWidth = 100 / numDays;

  return (
    <>
      <section className="surface overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border">
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
            <h2 className="tabular min-w-[150px] px-1 text-sm font-semibold text-foreground">
              {formatDateRange(days[0], days[days.length - 1])}
            </h2>
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

          <div className="flex flex-wrap items-center gap-2">
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
            <div className="sticky top-0 z-20 flex border-b bg-muted/40">
              <div className="sticky left-0 z-10 flex w-44 shrink-0 items-end border-r bg-[#FAFAF9] px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Unit
              </div>
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
                        day.getDay() === 1 && i > 0 && 'border-l border-l-border'
                      )}
                    >
                      {monthStart && (
                        <span className="absolute top-0.5 left-1.5 text-[10px] font-semibold uppercase text-muted-foreground/80">
                          {day.toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      )}
                      <span className="mt-2.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {day.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, calendarView === 'month' ? 1 : 3)}
                      </span>
                      <span
                        className={cn(
                          'tabular mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                          isToday ? 'bg-[var(--brand-red)] text-white' : 'text-foreground'
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            {filteredUnits.length === 0 ? (
              <EmptyState
                icon={CalendarSearch}
                title="No units match these filters"
                description="Try a different status or unit type."
                action={
                  <Button variant="outline" onClick={() => { setStatusFilter('ALL'); setUnitTypeFilter('ALL'); }}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              filteredUnits.map((unit) => {
                const inService = unit.status === 'MAINTENANCE';
                return (
                  <div key={unit.id} className="group flex border-b last:border-b-0">
                    <Link
                      href={`/units/${unit.id}`}
                      className="sticky left-0 z-10 flex w-44 shrink-0 items-center gap-3 border-r bg-white px-4 py-2 group-hover:bg-[#FAFAF9]"
                    >
                      <UnitTypeIcon type={unit.unitType} />
                      <div className="min-w-0">
                        <div className="font-mono-unit text-[13px] text-foreground">{unit.id}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {inService ? 'In service' : `${UNIT_SIZE_LABELS[unit.size]} · ${unit.powerType === 'INDUSTRIAL' ? '32A' : '13A'}`}
                        </div>
                      </div>
                    </Link>
                    <div className={cn('relative flex h-14 flex-1', inService && 'bg-hatch')}>
                      {days.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 border-r border-border/60 last:border-r-0',
                            (day.getDay() === 0 || day.getDay() === 6) && 'bg-muted/40',
                            day.getDay() === 1 && i > 0 && 'border-l border-l-border'
                          )}
                        />
                      ))}
                      {todayIndex >= 0 && (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-[5] w-px bg-[var(--brand-red)]/50"
                          style={{ left: `${(todayIndex + 0.5) * colWidth}%` }}
                        />
                      )}
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
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelected(b)}
                            title={`${b.customer.name} · ${formatDateRange(b.startDate, b.endDate)}`}
                            className={cn(
                              'absolute top-2 bottom-2 z-[6] flex min-w-0 flex-col justify-center overflow-hidden border-l-[3px] px-2 text-left shadow-[var(--shadow-xs)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                              BAR_STYLES[b.status],
                              clippedL ? 'rounded-l-none border-l-0 pl-2.5' : 'rounded-l-md',
                              clippedR ? 'rounded-r-none' : 'rounded-r-md'
                            )}
                            style={{ left: `calc(${cs * colWidth}% + 2px)`, width: `calc(${span * colWidth}% - 4px)` }}
                          >
                            <span className="truncate text-xs font-semibold leading-tight">{b.customer.name}</span>
                            {span >= 3 && (
                              <span className="tabular truncate text-[10px] leading-tight opacity-75">
                                {formatDateRange(b.startDate, b.endDate)}
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
          <span className="flex items-center gap-2">
            <span className="bg-hatch h-3 w-5 rounded-sm border" /> In service
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-px bg-[var(--brand-red)]" /> Today
          </span>
          <span className="ml-auto hidden sm:inline">Click a booking for details</span>
        </div>
      </section>

      {/* Quick view */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono-unit text-xs text-muted-foreground">{selected.id}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <SheetTitle className="mt-1 text-lg font-semibold">{selected.customer.name}</SheetTitle>
                <SheetDescription>
                  {formatDateRange(selected.startDate, selected.endDate)} · {daysBetween(selected.startDate, selected.endDate)} days
                </SheetDescription>
              </SheetHeader>
              <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-2 gap-3">
                  <Fact label="Delivery" value={formatDate(selected.startDate, { year: true })} sub={selected.deliveryTime} />
                  <Fact label="Collection" value={formatDate(selected.endDate, { year: true })} sub={selected.collectionTime} />
                </div>
                <dl className="divide-y rounded-md border text-sm">
                  <Row icon={<UnitTypeIcon type={selected.unit.unitType} />} label="Unit">
                    <span className="font-mono-unit text-[13px]">{selected.unit.id}</span>
                    <span className="text-muted-foreground"> · {UNIT_TYPE_LABELS[selected.unit.unitType]}</span>
                  </Row>
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
                    {POWER_LABELS[selected.powerAvailable]}
                  </Row>
                </dl>
                {selected.notes && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Notes</div>
                    <p className="rounded-md bg-muted/60 p-3 text-sm text-foreground">{selected.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t px-5 py-4">
                <Link
                  href={`/bookings/${selected.id}`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--brand-red)] text-sm font-medium text-white hover:bg-[var(--brand-red-dark)]"
                >
                  Open booking <ArrowUpRight className="size-4" />
                </Link>
                <Link
                  href={`/customers/${selected.customerId}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                >
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
    <div className="rounded-md border p-3">
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
