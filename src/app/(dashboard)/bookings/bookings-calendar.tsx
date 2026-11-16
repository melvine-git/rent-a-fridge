'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import {
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  Info,
  List,
  MapPin,
  Phone,
  RotateCcw,
  Thermometer,
  TriangleAlert,
  Truck,
  User,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Booking, Unit, UnitType, BookingWithDetails } from '@/types';
import type { BookingListItem } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { GBP, STATUS_META, TONE_CLASSES, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, nextServiceDate, powerLabel, unitDisplayStatus, type UnitDisplayStatus } from '@/lib/domain';
import { bookingRef } from '@/lib/jobs';
import { daysBetween, formatDate, formatDateRange, formatPhone, toISODate } from '@/lib/format';

export type PlannerView = 'timeline' | 'list';

interface BookingsCalendarProps {
  bookings: BookingWithDetails[];
  allUnits: Unit[];
  list: BookingListItem[];
  view: PlannerView;
  onView: (v: PlannerView) => void;
  /** Rendered in place of the timeline when the list view is chosen */
  listSlot: React.ReactNode;
}

type BarKind = 'onhire' | 'delivery' | 'collection' | 'service' | 'scheduled' | 'breakdown' | 'available';
type Bar = { key: string; kind: BarKind; s: number; e: number; title: string; sub?: string; alert?: boolean; booking?: BookingWithDetails; href?: string };

const BAR: Record<BarKind, { cls: string; icon?: LucideIcon; iconCls?: string }> = {
  onhire: { cls: 'border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100/80', icon: Truck, iconCls: 'text-blue-600' },
  delivery: { cls: 'border-sky-200 bg-sky-50/70 text-sky-950 hover:bg-sky-100/80', icon: Truck, iconCls: 'text-sky-500' },
  collection: { cls: 'border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100/80', icon: Truck, iconCls: 'text-orange-600' },
  service: { cls: 'border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100/80', icon: Wrench, iconCls: 'text-violet-600' },
  scheduled: { cls: 'border-violet-200 bg-violet-50/70 text-violet-950 hover:bg-violet-100/70', icon: Wrench, iconCls: 'text-violet-500' },
  breakdown: { cls: 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100/70', icon: TriangleAlert, iconCls: 'text-red-600' },
  available: { cls: 'border-dashed border-emerald-400 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/60', icon: CircleCheck, iconCls: 'text-emerald-600' },
};

const LEGEND: { label: string; dot: string }[] = [
  { label: 'On hire', dot: 'bg-blue-500' },
  { label: 'Delivery', dot: 'bg-sky-300' },
  { label: 'Collection', dot: 'bg-orange-400' },
  { label: 'Service', dot: 'bg-violet-500' },
  { label: 'Breakdown', dot: 'bg-red-500' },
];

const QUICK: { key: UnitDisplayStatus; label: string; badge: string }[] = [
  { key: 'ON_HIRE', label: 'On hire', badge: 'bg-stone-100 text-stone-700' },
  { key: 'AVAILABLE', label: 'Available', badge: 'bg-emerald-50 text-emerald-700' },
  { key: 'MAINTENANCE', label: 'Service', badge: 'bg-orange-50 text-orange-700' },
  { key: 'BREAKDOWN', label: 'Breakdown', badge: 'bg-red-50 text-red-700' },
];
const ALL_STATUSES = QUICK.map((q) => q.key);

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

const rangeLabel = (a: Date, b: Date) => `${formatDateRange(a, b)} ${b.getFullYear()}`;

export function BookingsCalendar({ bookings, allUnits, list, view, onView, listSlot }: BookingsCalendarProps) {
  const router = useRouter();
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [numDays, setNumDays] = useState<14 | 28>(14);
  const [statuses, setStatuses] = useState<UnitDisplayStatus[]>(ALL_STATUSES);
  const [types, setTypes] = useState<UnitType[]>([]);
  const [jobsOnly, setJobsOnly] = useState(false);
  const [sortDesc, setSortDesc] = useState(false);
  const [quickOpen, setQuickOpen] = useState(true);
  const [selected, setSelected] = useState<BookingWithDetails | null>(null);
  const [hover, setHover] = useState<{ unit: Unit; booking?: BookingWithDetails; x: number; y: number } | null>(null);
  const datePicker = useRef<HTMLInputElement>(null);

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
  const first = dayISO[0];
  const last = dayISO[numDays - 1];
  const idx = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00`) - days[0].getTime()) / DAY_MS);
  const todayIndex = dayISO.indexOf(todayISO);
  const colWidth = 100 / numDays;

  const bookingsByUnit = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>();
    for (const b of bookings) map.set(b.unitId, [...(map.get(b.unitId) ?? []), b]);
    return map;
  }, [bookings]);

  const counts = Object.fromEntries(QUICK.map((q) => [q.key, allUnits.filter((u) => unitDisplayStatus(u) === q.key).length])) as Record<UnitDisplayStatus, number>;
  // A delivery or collection falls in the days shown (late and overdue ones count too)
  const hasJob = (u: Unit) => (bookingsByUnit.get(u.id) ?? []).some((b) => (b.status === 'CONFIRMED' ? b.startDate : b.endDate) <= last);

  const units = allUnits
    .filter((u) => statuses.includes(unitDisplayStatus(u)) && (types.length === 0 || types.includes(u.unitType)) && (!jobsOnly || hasJob(u)))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }) * (sortDesc ? -1 : 1));

  // An overdue unit is still out, so it stays taken until it is actually collected
  const taken = (b: Booking, d: string) => occupies(b, d, todayISO) || (b.status === 'ON_HIRE' && b.endDate < todayISO && d >= b.startDate);
  const bookedDays = (u: Unit) => dayISO.filter((d) => (bookingsByUnit.get(u.id) ?? []).some((b) => taken(b, d))).length;
  const rentable = units.filter((u) => unitDisplayStatus(u) !== 'MAINTENANCE' && !u.breakdown);
  const fleetOccupancy = rentable.length ? Math.round((rentable.reduce((n, u) => n + bookedDays(u), 0) / (rentable.length * numDays)) * 100) : 0;

  const filtersActive = statuses.length !== ALL_STATUSES.length || types.length > 0 || jobsOnly;
  const clearFilters = () => {
    setStatuses(ALL_STATUSES);
    setTypes([]);
    setJobsOnly(false);
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const shift = (dir: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
  };
  const pickDate = () => {
    const el = datePicker.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  function barsFor(u: Unit): Bar[] {
    const bars: Bar[] = [];
    const busy = new Set<number>();
    const clip = (s: number, e: number) => (e < 0 || s > numDays - 1 ? null : { s: Math.max(0, s), e: Math.min(numDays - 1, e) });
    const status = unitDisplayStatus(u);

    for (const b of bookingsByUnit.get(u.id) ?? []) {
      const start = b.status === 'ON_HIRE' && b.startDate > todayISO ? todayISO : b.startDate;
      const overdue = b.status === 'ON_HIRE' && b.endDate < todayISO;
      const late = b.status === 'CONFIRMED' && b.startDate < todayISO;
      const end = overdue ? (last > todayISO ? last : todayISO) : b.endDate;
      const r = clip(idx(late ? todayISO : start), idx(end < start ? start : end));
      if (!r) continue;
      for (let i = r.s; i <= r.e; i++) busy.add(i);
      const collecting = b.status === 'ON_HIRE' && daysBetween(todayISO, b.endDate) <= 3;
      bars.push({
        key: b.id,
        kind: b.status === 'CONFIRMED' ? 'delivery' : collecting || overdue ? 'collection' : 'onhire',
        ...r,
        title: b.customer.name,
        sub: late
          ? `Delivery late · was due ${formatDate(b.startDate)}`
          : overdue
            ? `Collection overdue · ${formatDate(b.endDate)}`
            : b.status === 'CONFIRMED'
              ? `Delivery ${formatDate(b.startDate)} · back ${formatDate(b.endDate)}`
              : `On hire · Collection ${formatDate(b.endDate)}`,
        alert: late || overdue,
        booking: b,
      });
    }

    const service = nextServiceDate(u);
    if (u.breakdown) {
      const r = clip(Math.max(idx(u.breakdown.reportedAt.slice(0, 10)), todayIndex >= 0 ? todayIndex : idx(first)), numDays - 1);
      if (r) bars.push({ key: 'bd', kind: 'breakdown', ...r, title: 'Breakdown', sub: u.breakdown.notes || 'Out of action until marked fixed', href: `/units/${u.id}` });
    } else if (status === 'MAINTENANCE') {
      const until = service && service >= todayISO ? service : undefined;
      const r = clip(Math.max(idx(todayISO), 0), until ? idx(until) : numDays - 1);
      if (r) bars.push({ key: 'svc', kind: 'service', ...r, title: u.notes || 'In service', sub: until ? `In service · Until ${formatDate(until)}` : 'In service', href: `/units/${u.id}` });
    } else {
      if (service && service >= todayISO && service >= first && service <= last && !busy.has(idx(service))) {
        busy.add(idx(service));
        bars.push({ key: 'sch', kind: 'scheduled', s: idx(service), e: idx(service), title: 'Service', sub: `Scheduled · ${formatDate(service)}`, href: `/units/${u.id}` });
      }
      // Free runs from today onwards, each one a click away from a booking
      let runStart = -1;
      const from = Math.max(0, todayIndex >= 0 ? todayIndex : first > todayISO ? 0 : numDays);
      for (let i = from; i <= numDays; i++) {
        const free = i < numDays && !busy.has(i);
        if (free && runStart < 0) runStart = i;
        if (!free && runStart >= 0) {
          bars.push({ key: `free-${runStart}`, kind: 'available', s: runStart, e: i - 1, title: 'Available for hire', href: `/bookings/new?unit=${encodeURIComponent(u.id)}&start=${dayISO[runStart]}` });
          runStart = -1;
        }
      }
    }
    return bars;
  }

  const showHover = (e: React.MouseEvent, unit: Unit, booking?: BookingWithDetails) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = r.left + Math.min(r.width, 260) + 10;
    setHover({ unit, booking, x: x + 300 > window.innerWidth ? Math.max(8, r.left - 310) : x, y: Math.min(r.top, window.innerHeight - 340) });
  };

  const selectedRef = selected ? bookingRef(selected) : null;
  const selectedItem = selectedRef ? list.find((l) => l.reference === selectedRef) : undefined;
  const siblings = selected ? bookings.filter((b) => bookingRef(b) === selectedRef) : [];
  const isLate = (b: Booking) => (b.status === 'CONFIRMED' && b.startDate < todayISO) || (b.status === 'ON_HIRE' && b.endDate < todayISO);
  const chip = (active: boolean) =>
    cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors', active ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-foreground hover:bg-muted');

  return (
    <div className="grid gap-4 lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Filters */}
      <aside className="h-fit space-y-5 rounded-2xl border bg-white p-4 shadow-[var(--shadow-xs)] lg:sticky lg:top-20">
        <Section title="View">
          <div className="grid grid-cols-2 gap-1 rounded-lg border bg-white p-0.5">
            {(
              [
                ['timeline', 'Timeline', CalendarRange],
                ['list', 'List', List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={cn('inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors', view === v ? 'bg-red-50 text-red-700' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </Section>

        {view === 'timeline' && (
          <>
            <Section title="Date range">
              <button type="button" onClick={pickDate} className="flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="tabular flex-1 truncate text-left">{rangeLabel(days[0], days[numDays - 1])}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
              <input
                ref={datePicker}
                type="date"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                value={first}
                onChange={(e) => e.target.value && setAnchor(new Date(`${e.target.value}T00:00:00`))}
              />
            </Section>

            <div className="border-t pt-4">
              <button type="button" onClick={() => setQuickOpen((o) => !o)} className="flex w-full items-center justify-between text-[13px] font-semibold text-foreground">
                Quick filters <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !quickOpen && '-rotate-90')} />
              </button>
              {quickOpen && (
                <ul className="mt-2.5 space-y-1">
                  {QUICK.map((q) => (
                    <li key={q.key}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-[13px] text-foreground">
                        <input type="checkbox" checked={statuses.includes(q.key)} onChange={() => setStatuses((s) => toggle(s, q.key))} className="size-4 rounded accent-stone-900" />
                        <span className="flex-1">{q.label}</span>
                        <span className={cn('tabular min-w-6 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold', q.badge)}>{counts[q.key]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Section title="Type" divided>
              <ul className="space-y-1">
                {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => {
                  const Icon = UNIT_TYPE_ICON[t];
                  return (
                    <li key={t}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-[13px] text-foreground">
                        <input type="checkbox" checked={types.includes(t)} onChange={() => setTypes((s) => toggle(s, t))} className="size-4 rounded accent-stone-900" />
                        <Icon className="size-4 text-muted-foreground" />
                        {UNIT_TYPE_LABELS[t]}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Collections & deliveries" divided>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
                <button
                  type="button"
                  role="switch"
                  aria-checked={jobsOnly}
                  onClick={() => setJobsOnly((v) => !v)}
                  className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', jobsOnly ? 'bg-stone-900' : 'bg-stone-200')}
                >
                  <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', jobsOnly && 'translate-x-4')} />
                </button>
                Show only del/col
              </label>
            </Section>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="flex items-center gap-2 border-t pt-4 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
            >
              <RotateCcw className="size-3.5" /> Clear filters
            </button>
          </>
        )}
      </aside>

      {view === 'list' ? (
        <div className="min-w-0">{listSlot}</div>
      ) : (
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-lg border bg-white">
                <button type="button" onClick={() => shift(-1)} aria-label="Previous week" className="flex size-8 items-center justify-center hover:bg-muted">
                  <ChevronLeft className="size-4" />
                </button>
                <button type="button" onClick={() => setAnchor(mondayOf(new Date()))} className="h-8 border-x px-3 text-[13px] font-medium hover:bg-muted">
                  Today
                </button>
                <button type="button" onClick={() => shift(1)} aria-label="Next week" className="flex size-8 items-center justify-center hover:bg-muted">
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <button type="button" onClick={pickDate} className="tabular inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                {rangeLabel(days[0], days[numDays - 1])} <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex shrink-0 gap-1 rounded-lg bg-muted/60 p-0.5">
                {([14, 28] as const).map((n) => (
                  <button key={n} type="button" onClick={() => setNumDays(n)} className={cn('h-7 rounded-md px-3 text-[13px] font-medium transition-colors', numDays === n ? 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200' : 'text-muted-foreground hover:text-foreground')}>
                    {n / 7} weeks
                  </button>
                ))}
              </div>
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
              <button type="button" onClick={() => setTypes([])} className={chip(types.length === 0)}>
                All units <span className={cn('tabular rounded px-1 text-[11px] font-semibold', types.length === 0 ? 'bg-red-100/70' : 'bg-muted')}>{allUnits.length}</span>
              </button>
              {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => {
                const Icon = UNIT_TYPE_ICON[t];
                const on = types.length === 1 && types[0] === t;
                return (
                  <button key={t} type="button" onClick={() => setTypes(on ? [] : [t])} className={chip(on)}>
                    <Icon className="size-4" /> {UNIT_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          <div className="scrollbar-thin overflow-x-auto">
            <div className={numDays === 28 ? 'min-w-[1500px]' : 'min-w-[1000px]'}>
              <div className="flex border-b">
                <div className="sticky left-0 z-20 flex w-[130px] shrink-0 border-r bg-white sm:w-[240px]">
                  <button type="button" onClick={() => setSortDesc((d) => !d)} className="flex w-[130px] flex-col items-start justify-center px-4 py-2 text-left" title="Sort by unit">
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
                      Unit <ChevronsUpDown className="size-3 text-muted-foreground" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">Type</span>
                  </button>
                  <div className="hidden flex-1 items-center gap-1 px-2 text-[12px] font-semibold text-foreground sm:flex" title="Share of the days shown that the unit is booked">
                    Occupancy <Info className="size-3 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex flex-1">
                  {days.map((day, i) => {
                    const isToday = i === todayIndex;
                    const weekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={i} className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 border-r py-2 last:border-r-0', isToday ? 'bg-red-50' : weekend && 'bg-stone-50')}>
                        <span className={cn('text-[10px] font-semibold tracking-wide uppercase', isToday ? 'text-[var(--brand-red)]' : 'text-muted-foreground')}>
                          {day.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, numDays === 28 ? 1 : 3)}
                        </span>
                        <span className={cn('tabular flex size-6 items-center justify-center rounded-full text-[13px] font-semibold', isToday ? 'bg-[var(--brand-red)] text-white' : 'text-foreground')}>{day.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {units.length === 0 ? (
                <EmptyState
                  icon={CalendarSearch}
                  title="No units match these filters"
                  description="Try a different status or unit type."
                  action={
                    <button type="button" onClick={clearFilters} className="text-sm font-medium text-[var(--brand-red)] hover:underline">
                      Clear filters
                    </button>
                  }
                />
              ) : (
                units.map((unit) => {
                  const status = unitDisplayStatus(unit);
                  const occ = Math.round((bookedDays(unit) / numDays) * 100);
                  return (
                    <div key={unit.id} className="group/row flex border-b last:border-b-0">
                      <div className="sticky left-0 z-10 flex w-[130px] shrink-0 border-r bg-white transition-colors group-hover/row:bg-stone-50 sm:w-[240px]">
                        <Link
                          href={`/units/${unit.id}`}
                          onMouseEnter={(e) => showHover(e, unit)}
                          onMouseLeave={() => setHover(null)}
                          className="flex w-[130px] items-center gap-2.5 px-3 py-2"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-b from-white to-stone-100 text-stone-700">
                            <UnitTypeIcon type={unit.unitType} className="size-4 text-stone-700" />
                          </span>
                          <span className="min-w-0">
                            <span className="font-mono-unit block text-[13px] font-semibold text-foreground">{unit.id}</span>
                            <span className={cn('block truncate text-[11px]', status === 'BREAKDOWN' ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                              {status === 'BREAKDOWN' ? 'Breakdown' : status === 'MAINTENANCE' ? 'In service' : UNIT_SIZE_LABELS[unit.size]}
                            </span>
                          </span>
                        </Link>
                        <div className="hidden flex-1 flex-col justify-center gap-1 px-2 sm:flex">
                          <span className="tabular text-[12px] font-semibold text-foreground">{occ}%</span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                            <span className={cn('block h-full rounded-full', occ >= 90 ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${occ}%` }} />
                          </span>
                        </div>
                      </div>
                      <div className={cn('relative flex h-[52px] flex-1', status === 'MAINTENANCE' && 'bg-hatch', status === 'BREAKDOWN' && 'bg-red-50/30')}>
                        {days.map((day, i) => (
                          <div key={i} className={cn('flex-1 border-r border-border/50 last:border-r-0', i === todayIndex ? 'bg-red-50/50' : (day.getDay() === 0 || day.getDay() === 6) && 'bg-stone-50/70')} />
                        ))}
                        {todayIndex >= 0 && <div className="pointer-events-none absolute inset-y-0 z-[8] w-px bg-[var(--brand-red)]" style={{ left: `${todayIndex * colWidth}%` }} />}
                        {barsFor(unit).map((bar) => {
                          const style = BAR[bar.kind];
                          const span = bar.e - bar.s + 1;
                          const Icon = style.icon;
                          const avail = bar.kind === 'available';
                          const inline = bar.kind === 'breakdown';
                          const onClick = () => (bar.booking ? setSelected(bar.booking) : bar.href && router.push(bar.href));
                          return (
                            <button
                              key={bar.key}
                              type="button"
                              onClick={onClick}
                              onMouseEnter={(e) => showHover(e, unit, bar.booking)}
                              onMouseLeave={() => setHover(null)}
                              aria-label={`${unit.id}: ${bar.title}${bar.sub ? `, ${bar.sub}` : ''}`}
                              className={cn(
                                'absolute top-1.5 bottom-1.5 z-[6] flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border px-2.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                                style.cls,
                                avail && 'justify-center shadow-none',
                                !avail && 'hover:-translate-y-px hover:shadow-[var(--shadow-md)]'
                              )}
                              style={{ left: `calc(${bar.s * colWidth}% + 3px)`, width: `calc(${span * colWidth}% - 6px)` }}
                            >
                              {Icon && (span >= 2 || !avail) && <Icon className={cn('size-4 shrink-0', style.iconCls)} />}
                              {avail ? (
                                span >= 2 && <span className="truncate text-[12px] font-medium">{bar.title}</span>
                              ) : inline ? (
                                <span className="truncate text-[12px] font-medium">
                                  {bar.title}
                                  {bar.sub && span >= 2 && <span className="font-normal opacity-80"> · {bar.sub}</span>}
                                </span>
                              ) : (
                                span >= 2 && (
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] leading-tight font-semibold">{bar.title}</span>
                                    {bar.sub && <span className={cn('block truncate text-[10.5px] leading-tight', bar.alert ? 'font-medium text-red-600' : 'opacity-70')}>{bar.sub}</span>}
                                  </span>
                                )
                              )}
                              {!avail && !inline && span >= 3 && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-30" />}
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
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', l.dot)} /> {l.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded border border-dashed border-emerald-400 bg-emerald-50" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-hatch h-3 w-5 rounded border" /> In service
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-foreground" title="Share of days booked across the units shown that can be hired">
                Fleet occupancy: {fleetOccupancy}% <Info className="size-3 text-muted-foreground" />
              </span>
              <span className="h-2 w-40 overflow-hidden rounded-full bg-stone-200">
                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${fleetOccupancy}%` }} />
              </span>
            </div>
          </div>
        </section>
      )}

      {hover && <UnitHoverCard {...hover} today={todayISO} occupancy={Math.round((bookedDays(hover.unit) / numDays) * 100)} />}

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
    </div>
  );
}

function Section({ title, divided, children }: { title: string; divided?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(divided && 'border-t pt-4')}>
      <h3 className="mb-2 text-[13px] font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** Floating card with the unit's details, shown while hovering its row or any of its bars. */
function UnitHoverCard({ unit, booking, x, y, today, occupancy }: { unit: Unit; booking?: BookingWithDetails; x: number; y: number; today: string; occupancy: number }) {
  const status = unitDisplayStatus(unit);
  const meta = STATUS_META[status];
  const photo = unit.specifications?.photoUrls?.[0];
  const dims = unit.specifications?.externalDimensions;
  const service = nextServiceDate(unit);
  const capacity = unit.specifications?.cubicCapacity;
  return (
    <div className="pointer-events-none fixed z-50 w-[300px] overflow-hidden rounded-xl border bg-white shadow-[0_12px_32px_-8px_rgb(0_0_0/0.25)]" style={{ left: x, top: y }} role="tooltip">
      <div className="flex items-center gap-3 border-b p-3.5">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from the private uploads route
          <img src={photo} alt="" className="size-12 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-b from-white to-stone-100">
            <UnitTypeIcon type={unit.unitType} className="size-5 text-stone-700" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono-unit text-[15px] font-semibold text-foreground">{unit.id}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset', TONE_CLASSES[meta.tone].badge)}>{meta.label}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {UNIT_TYPE_LABELS[unit.unitType]} · {UNIT_SIZE_LABELS[unit.size]}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3.5 text-xs">
        <HoverFact label="Capacity" value={capacity ? `${capacity} m³` : '—'} />
        <HoverFact label="Occupancy (view)" value={`${occupancy}%`} />
        <HoverFact label="Next service" value={service ? formatDate(service) : 'Not scheduled'} warn={!!service && service < today} />
        <HoverFact label="Size (L×W×H)" value={dims ? `${dims.length}×${dims.width}×${dims.height}` : '—'} />
        {unit.dataLoggerId && <HoverFact label="Data logger" value={unit.dataLoggerId} />}
        {unit.specifications?.doorAccess && <HoverFact label="Door access" value={unit.specifications.doorAccess} />}
      </dl>
      {(unit.breakdown || (status === 'MAINTENANCE' && unit.notes)) && (
        <p className={cn('mx-3.5 mb-3.5 rounded-lg px-2.5 py-2 text-xs', unit.breakdown ? 'bg-red-50 text-red-800' : 'bg-violet-50 text-violet-900')}>
          {unit.breakdown ? `Broken down ${formatDate(unit.breakdown.reportedAt)}${unit.breakdown.notes ? ` · ${unit.breakdown.notes}` : ''}` : unit.notes}
        </p>
      )}
      {booking && (
        <div className="space-y-1 border-t bg-stone-50/70 p-3.5 text-xs">
          <p className="font-semibold text-foreground">{booking.customer.name}</p>
          <p className="tabular text-muted-foreground">
            {formatDateRange(booking.startDate, booking.endDate)} · {daysBetween(booking.startDate, booking.endDate)} days
          </p>
          <p className="truncate text-muted-foreground">{booking.deliveryAddress}</p>
          <p className="pt-1 text-[11px] text-muted-foreground/80">Click for booking details</p>
        </div>
      )}
    </div>
  );
}

function HoverFact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-medium', warn ? 'text-red-600' : 'text-foreground')}>{value}</dd>
    </div>
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
