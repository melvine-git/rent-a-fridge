'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KpiDrilldown } from '@/components/app/kpi-drilldown';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { HeroScene } from '@/components/dispatch/hero-scene';
import { JobDrawer, accessoryItems, type JobTarget, type JobType } from '@/components/jobs/job-drawer';
import { powerShort } from '@/lib/domain';
import { hireSteps, type LineJob } from '@/lib/hire-steps';
import { bookingRef, groupVisits, visitOf } from '@/lib/jobs';
import { formatDate, formatPhone, w3wUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingWithDetails, DeliveryChecklist, Staff } from '@/types';
import {
  Activity,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  ArrowUpFromLine,
  Box,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Lock,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  PencilLine,
  Phone,
  RotateCcw,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type Job = BookingWithDetails;
type Stop = { key: string; kind: JobType; date: string; time?: string; lines: Job[]; overdue: boolean };
type Completed = { id: string; type: 'DELIVERY' | 'COLLECTION'; unitId: string; customer: string; signedBy: string; hasSignature: boolean; completedAt: string; href: string };
type LatLng = { lat: number; lng: number };

interface DeliveriesViewProps {
  today: string;
  deliveries: Job[];
  collections: Job[];
  onHire: Job[];
  delivered: Record<string, DeliveryChecklist | undefined>;
  completed: Completed[];
  collectedHistory: { id: string; unitId: string; customer: string; signedBy: string; completedAt: string; href: string }[];
  doneToday: { deliveries: number; collections: number };
  jobs: Record<string, LineJob[]>;
  staff: Staff[];
  coords: Record<string, LatLng>;
  yard: LatLng | null;
  heroImage?: string;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
};
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const byStart = (b: Job) => b.startDate;
const byEnd = (b: Job) => b.endDate;
const ORDER_KEY = 'raf-dispatch-order';
const WEEKS = 4;

/** Straight-line distance in km. */
function km(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function DeliveriesView({ today, deliveries, collections, onHire, delivered, collectedHistory, doneToday, jobs, staff, coords, yard, heroImage }: DeliveriesViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const [day, setDay] = useState(today);
  const [week, setWeek] = useState(0);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Hand-made or optimised stop order per day, kept on this device
  const [order, setOrder] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device after hydration
      setOrder(JSON.parse(localStorage.getItem(ORDER_KEY) ?? '{}'));
    } catch {}
  }, []);
  const saveOrder = (d: string, keys: string[] | null) => {
    setOrder((o) => {
      const next = { ...o };
      if (keys) next[d] = keys;
      else delete next[d];
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const tomorrow = addDays(today, 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, week * 7 + i));

  const stops: Stop[] = [
    ...groupVisits(deliveries, byStart).map((lines) => ({ kind: 'delivery' as const, lines, date: lines[0].startDate, time: lines[0].deliveryTime })),
    ...groupVisits(collections, byEnd).map((lines) => ({ kind: 'collection' as const, lines, date: lines[0].endDate, time: lines[0].collectionTime })),
  ].map((s) => ({ ...s, key: `${s.kind}-${s.lines[0].id}`, overdue: s.date < today, date: s.date < today ? today : s.date }));
  const stopsOn = (d: string) =>
    stops
      .filter((s) => s.date === d)
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.kind.localeCompare(b.kind));
  const timeOrder = stopsOn(day);
  const custom = order[day];
  const run = custom ? [...timeOrder].sort((a, b) => (custom.indexOf(a.key) + 1 || 999) - (custom.indexOf(b.key) + 1 || 999)) : timeOrder;
  const overdueCount = stops.filter((s) => s.overdue).length;
  const sel = run.find((s) => s.key === selKey) ?? run[0];

  const open = (lines: Job[], type: JobType) => setJob({ bookings: lines, type, delivered });
  const toItems = (list: Stop[]) =>
    list.map((s) => ({
      key: s.key,
      href: `/bookings/${bookingRef(s.lines[0])}`,
      title: s.lines[0].customer.name,
      subtitle: `${s.lines.map((l) => l.unit.id).join(', ')} · ${s.lines[0].deliveryAddress}`,
      meta: s.overdue ? 'Overdue' : (s.time ?? formatDate(s.date)),
    }));

  const optimise = () => {
    const placed = run.filter((s) => coords[s.lines[0].id]);
    if (placed.length < 2) {
      toast.info(placed.length ? 'Only one stop has a map position, so there is nothing to reorder.' : 'None of these stops have a postcode we can place on the map.');
      return;
    }
    // Nearest stop next, starting from the yard
    let here: LatLng = yard ?? coords[placed[0].lines[0].id];
    let distance = 0;
    const left = [...placed];
    const ordered: Stop[] = [];
    while (left.length) {
      left.sort((a, b) => km(here, coords[a.lines[0].id]) - km(here, coords[b.lines[0].id]));
      const next = left.shift()!;
      distance += km(here, coords[next.lines[0].id]);
      here = coords[next.lines[0].id];
      ordered.push(next);
    }
    saveOrder(day, [...ordered, ...run.filter((s) => !coords[s.lines[0].id])].map((s) => s.key));
    toast.success(`Run optimised by distance · about ${Math.round(distance)} km between stops${yard ? ' from the yard' : ''}`);
  };
  const needTwo = (what: string) =>
    toast.info(`${what} needs at least two stops on the day`, {
      description: `${day === today ? 'Today' : dayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })} has ${plural(run.length, 'stop', 'stops')}, so there is nothing to reorder.`,
    });
  const move = (i: number, d: number) => {
    const keys = run.map((s) => s.key);
    [keys[i], keys[i + d]] = [keys[i + d], keys[i]];
    saveOrder(day, keys);
  };

  return (
    <div className="space-y-6">
      {/* Hero: headline numbers and the day picker over the mountain scene */}
      <section className="relative -mx-4 -mt-6 px-4 pt-6 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
        <HeroScene image={heroImage} />
        <div className={cn('relative space-y-5', heroImage && 'xl:max-w-[68%]')}>
          <div className={heroImage ? undefined : 'xl:max-w-[1000px]'}>
            <KpiDrilldown
              variant="hero"
              cards={[
                {
                  key: 'today',
                  label: 'Deliveries today',
                  icon: Package,
                  tone: 'danger',
                  hint: stops.some((s) => s.kind === 'delivery' && s.overdue) ? `incl. ${stops.filter((s) => s.kind === 'delivery' && s.overdue).length} late` : undefined,
                  items: toItems(stopsOn(today).filter((s) => s.kind === 'delivery')),
                  emptyText: 'No deliveries today',
                },
                { key: 'tomorrow', label: 'Deliveries tomorrow', icon: Truck, tone: 'neutral', items: toItems(stopsOn(tomorrow).filter((s) => s.kind === 'delivery')), emptyText: 'Nothing scheduled for tomorrow' },
                {
                  key: 'due',
                  label: 'Collections due',
                  icon: PackageCheck,
                  tone: 'danger',
                  emphasis: stops.some((s) => s.kind === 'collection' && s.overdue),
                  items: toItems(stopsOn(today).filter((s) => s.kind === 'collection')),
                  emptyText: 'No collections due',
                },
                {
                  key: 'hire',
                  label: 'Units on hire',
                  icon: Box,
                  tone: 'info',
                  items: onHire.map((h) => ({
                    key: h.id,
                    href: `/bookings/${bookingRef(h)}`,
                    title: (
                      <span className="flex items-center gap-2">
                        <UnitCode id={h.unit.id} /> {h.customer.name}
                      </span>
                    ),
                    subtitle: h.deliveryAddress,
                    meta: `Back ${formatDate(h.endDate)}`,
                    action: { label: h.endDate > today ? 'Collect early' : 'Collect', icon: PackageCheck, onClick: () => open(visitOf(h, onHire, byEnd), 'collection') },
                  })),
                  emptyText: 'No units on hire',
                },
                {
                  key: 'recover',
                  label: 'Accessories on site',
                  icon: Lock,
                  tone: 'warning',
                  items: onHire
                    .filter((h) => accessoryItems(h, delivered[h.id]).length > 0)
                    .map((h) => ({
                      key: h.id,
                      href: `/bookings/${bookingRef(h)}`,
                      title: (
                        <span className="flex items-center gap-2">
                          <UnitCode id={h.unit.id} /> {h.customer.name}
                        </span>
                      ),
                      subtitle: accessoryItems(h, delivered[h.id]).join(' · '),
                      meta: `Back ${formatDate(h.endDate)}`,
                    })),
                  emptyText: 'No locks, clamps, cables or recorders on site',
                },
                {
                  key: 'collected',
                  label: 'Collected',
                  icon: CircleCheck,
                  tone: 'success',
                  hint: 'All time',
                  items: collectedHistory.map((c) => ({
                    key: c.id,
                    href: c.href,
                    title: (
                      <span className="flex items-center gap-2">
                        <UnitCode id={c.unitId} /> {c.customer}
                      </span>
                    ),
                    subtitle: c.signedBy ? `Signed by ${c.signedBy}` : undefined,
                    meta: formatDate(c.completedAt.split('T')[0]),
                  })),
                  emptyText: 'No collections signed off yet',
                },
              ]}
            />
          </div>

          {/* Day rail */}
          <div className="flex items-center gap-2">
            <RoundButton icon={ChevronLeft} label="Previous week" disabled={week === 0} onClick={() => setWeek((w) => w - 1)} />
            <div className="flex flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
              {days.map((d) => {
                const list = stopsOn(d);
                const active = d === day;
                const hasOverdue = list.some((s) => s.overdue);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDay(d);
                      setSelKey(null);
                      setEditing(false);
                    }}
                    aria-pressed={active}
                    className={cn(
                      'flex min-w-[80px] flex-1 shrink-0 flex-col items-center rounded-2xl border px-1.5 py-2.5 whitespace-nowrap text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      active ? 'border-stone-900 bg-stone-900 text-white shadow-[0_10px_24px_-10px_rgb(0_0_0/0.5)]' : 'border-white/70 bg-white/85 backdrop-blur hover:bg-white hover:shadow-[var(--shadow-sm)]'
                    )}
                  >
                    <span className={cn('text-[11px] font-medium', active ? 'text-white/70' : 'text-muted-foreground')}>
                      {d === today ? 'Today' : d === tomorrow ? 'Tomorrow' : dayLabel(d, { weekday: 'short' })}
                    </span>
                    <span className="tabular text-[13px] font-semibold">{d === today || d === tomorrow ? dayLabel(d, { weekday: 'short', day: 'numeric', month: 'short' }) : dayLabel(d, { day: 'numeric', month: 'short' })}</span>
                    <span className={cn('mt-0.5 inline-flex items-center gap-1 text-[11px]', active ? 'text-white/80' : list.length ? 'text-foreground' : 'text-muted-foreground')}>
                      {hasOverdue && <span className="size-1.5 rounded-full bg-red-500" />}
                      {list.length ? `${list.length} stop${list.length > 1 ? 's' : ''}` : 'No stops'}
                    </span>
                  </button>
                );
              })}
            </div>
            <RoundButton icon={ChevronRight} label="Next week" disabled={week === WEEKS - 1} onClick={() => setWeek((w) => w + 1)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Run */}
        <section className="relative overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)] lg:col-span-2">
          <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {day === today ? "Today's run" : day === tomorrow ? "Tomorrow's run" : `Run for ${dayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                {run.length
                  ? `${plural(run.filter((s) => s.kind === 'delivery').length, 'delivery', 'deliveries')} · ${plural(run.filter((s) => s.kind === 'collection').length, 'collection', 'collections')}${day === today && overdueCount ? ` · ${overdueCount} overdue carried over` : ''}`
                  : 'Deliveries and collections in time order'}
              </p>
            </div>
            {run.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {custom && !editing && (
                  <button type="button" onClick={() => saveOrder(day, null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                    <RotateCcw className="size-3.5" /> Time order
                  </button>
                )}
                {!editing && (
                  <button type="button" onClick={() => (run.length < 2 ? needTwo('Optimise') : optimise())} className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-[13px] font-medium transition-colors hover:bg-muted" title="Order the stops by distance, nearest first">
                    <Sparkles className="size-4" /> Optimise
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (run.length < 2 && !editing ? needTwo('Edit run') : setEditing((e) => !e))}
                  title="Reorder the stops by hand"
                  className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors', editing ? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-800' : 'bg-white hover:bg-muted')}
                >
                  {editing ? <Check className="size-4" /> : <PencilLine className="size-4" />} {editing ? 'Done' : 'Edit run'}
                </button>
              </div>
            )}
          </header>

          {sel && <Stepper stop={sel} jobs={jobs} today={today} tomorrow={tomorrow} />}

          {run.length === 0 ? (
            <EndOfRun title="Nothing on the run" text="No deliveries or collections for this day. Pick another day above to plan ahead." />
          ) : (
            <>
              <ol className="relative space-y-3 px-4 pt-5 sm:px-6">
                <span className="absolute top-8 bottom-6 left-[62px] hidden w-0.5 rounded-full sm:block bg-gradient-to-b from-[var(--brand-red)] via-red-200 to-transparent" aria-hidden />
                {run.map((s, i) => (
                  <StopRow
                    key={s.key}
                    stop={s}
                    index={i + 1}
                    delivered={delivered}
                    selected={s.key === sel?.key}
                    onSelect={() => setSelKey(s.key)}
                    onAction={() => open(s.lines, s.kind)}
                    editing={editing}
                    onUp={i > 0 ? () => move(i, -1) : undefined}
                    onDown={i < run.length - 1 ? () => move(i, 1) : undefined}
                  />
                ))}
              </ol>
              <EndOfRun
                title={day === today ? 'No more stops today' : 'End of the run'}
                text={`Run complete after this ${run.at(-1)!.kind}. Upcoming runs will appear here.`}
              />
            </>
          )}
        </section>

        {/* Van load */}
        <VanLoad run={run} delivered={delivered} isToday={day === today} doneToday={doneToday} />
      </div>

      <JobDrawer
        job={job}
        staff={staff}
        onClose={() => setJob(null)}
        onCompleted={() => {
          setJob(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function RoundButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/90 text-foreground shadow-[var(--shadow-sm)] backdrop-blur transition-colors hover:bg-white disabled:opacity-40"
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Hire progress for the selected stop: booking, delivery, collection, back at the depot, complete. */
function Stepper({ stop, jobs, today, tomorrow }: { stop: Stop; jobs: Record<string, LineJob[]>; today: string; tomorrow: string }) {
  const steps = hireSteps(stop.lines, jobs, today, tomorrow).map((s, i, all) => (i === all.length - 1 ? { ...s, title: 'Complete' } : s));
  return (
    <div className="border-y bg-stone-50/40 px-6 py-5">
      <ol className="grid grid-cols-5">
        {steps.map((s, i) => {
          const next = steps[i + 1];
          return (
            <li key={s.title} className="relative flex flex-col items-center text-center">
              {next && (
                <span
                  className={cn('absolute top-[11px] left-1/2 h-0.5 w-full', next.state === 'done' ? 'bg-stone-900' : next.state === 'current' ? 'bg-[var(--brand-red)]' : 'bg-stone-200')}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex size-6 items-center justify-center rounded-full',
                  s.state === 'done' && 'bg-stone-900 text-white',
                  s.state === 'current' && 'border-2 border-[var(--brand-red)] bg-white',
                  s.state === 'todo' && 'border-2 border-stone-300 bg-white'
                )}
              >
                {s.state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className={cn('mt-2 px-1 text-[11px] leading-tight font-semibold sm:text-xs', s.state === 'current' ? 'text-[var(--brand-red)]' : s.state === 'todo' ? 'text-muted-foreground' : 'text-foreground')}>{s.title}</span>
              <span className={cn('tabular mt-0.5 text-[10.5px] sm:text-[11px]', s.state === 'current' ? 'font-medium text-[var(--brand-red)]' : 'text-muted-foreground')}>{s.time}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EndOfRun({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative mt-6 flex flex-col items-center gap-2 overflow-hidden px-6 pt-8 pb-12 text-center">
      <HeroScene className="opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_55%)] [&>div:first-child]:bg-none" />
      <span className="relative flex size-11 items-center justify-center rounded-full border bg-white text-muted-foreground shadow-[var(--shadow-xs)]">
        <CalendarCheck className="size-5" />
      </span>
      <p className="relative text-[15px] font-semibold text-foreground">{title}</p>
      <p className="relative max-w-sm text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function StopRow({
  stop,
  index,
  delivered,
  selected,
  onSelect,
  onAction,
  editing,
  onUp,
  onDown,
}: {
  stop: Stop;
  index: number;
  delivered: Record<string, DeliveryChecklist | undefined>;
  selected: boolean;
  onSelect: () => void;
  onAction: () => void;
  editing: boolean;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const b = stop.lines[0];
  const isDelivery = stop.kind === 'delivery';
  const items = stop.lines.flatMap((l) => accessoryItems(l, isDelivery ? undefined : delivered[l.id]).map((i) => (stop.lines.length > 1 ? `${l.unit.id}: ${i}` : i)));
  const temps = [...new Set(stop.lines.map((l) => `${l.tempRequired}°C`))].join(' / ');
  const mapHref = b.what3wordsAddress ? w3wUrl(b.what3wordsAddress) : `https://maps.google.com/?q=${encodeURIComponent(b.deliveryAddress)}`;
  const hot = stop.overdue || selected;

  return (
    <li className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-x-4">
      {/* Time + sequence on the run line */}
      <div className="flex flex-col items-center gap-1.5 pt-3">
        <span className={cn('tabular rounded-md px-2 py-0.5 text-[13px] font-semibold', hot ? 'bg-red-50 text-[var(--brand-red)] ring-1 ring-red-200' : 'bg-stone-100 text-foreground')}>{stop.time ?? 'Any'}</span>
        <span className={cn('relative z-10 flex size-3.5 items-center justify-center rounded-full border-2 bg-white', hot ? 'border-[var(--brand-red)]' : 'border-stone-300')} />
        {editing ? (
          <span className="flex flex-col gap-0.5">
            <button type="button" onClick={onUp} disabled={!onUp} aria-label="Move up" className="flex size-6 items-center justify-center rounded-md border bg-white hover:bg-muted disabled:opacity-30">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" onClick={onDown} disabled={!onDown} aria-label="Move down" className="flex size-6 items-center justify-center rounded-md border bg-white hover:bg-muted disabled:opacity-30">
              <ArrowDown className="size-3.5" />
            </button>
          </span>
        ) : (
          <span className="tabular flex size-5 items-center justify-center rounded-full bg-stone-100 text-[10px] font-semibold text-muted-foreground">{index}</span>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && onSelect()}
        aria-pressed={selected}
        className={cn(
          'flex min-w-0 flex-col gap-4 rounded-xl border p-4 text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex-row',
          stop.overdue ? 'border-red-100 bg-red-50/50' : 'bg-white',
          selected ? 'shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] ring-1 ring-red-200' : 'hover:shadow-[var(--shadow-sm)]'
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                stop.overdue ? 'bg-white text-red-700 ring-red-200' : isDelivery ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
              )}
            >
              {stop.overdue && <TriangleAlert className="size-3" />}
              {isDelivery ? 'Delivery' : 'Collection'}
              {stop.overdue && ` · was due ${formatDate(isDelivery ? b.startDate : b.endDate)}`}
            </span>
            <Link href={`/bookings/${bookingRef(b)}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground hover:underline">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{b.customer.name}</span>
            </Link>
            <span className="flex flex-wrap gap-1">
              {stop.lines.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5">
                  <UnitTypeIcon type={l.unit.unitType} className="size-3.5" />
                  <UnitCode id={l.unit.id} className="text-xs" />
                </span>
              ))}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{b.deliveryAddress}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <a href={`tel:${b.contactPhone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-foreground">
              <Phone className="size-3" /> {b.contactName} · {formatPhone(b.contactPhone)}
            </a>
            {isDelivery && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Thermometer className="size-3" /> {temps}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="size-3" /> {powerShort(b)}
                </span>
              </>
            )}
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                <Package className="size-3" /> {isDelivery ? 'Load:' : 'Bring back:'}
              </span>
              {items.map((i) => (
                <span key={i} className="rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 ring-1 ring-amber-600/15 ring-inset">
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-start gap-2 sm:w-[140px] sm:flex-col sm:items-stretch">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-colors sm:flex-none',
              isDelivery ? 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]' : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {isDelivery ? <Truck className="size-4" /> : <PackageCheck className="size-4" />}
            {isDelivery ? 'Deliver' : 'Collect'}
            {stop.lines.length > 1 && <span className="text-white/85">({stop.lines.length})</span>}
          </button>
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-muted sm:flex-none"
          >
            <Navigation className="size-4" /> Navigate
          </a>
        </div>
      </div>
    </li>
  );
}

/** What has to go on the van for the selected day, what comes back, and how the run is going. */
function VanLoad({ run, delivered, isToday, doneToday }: { run: Stop[]; delivered: Record<string, DeliveryChecklist | undefined>; isToday: boolean; doneToday: { deliveries: number; collections: number } }) {
  const tally = (stops: Stop[], from: (l: Job) => string[]) => {
    const counts = new Map<string, number>();
    for (const s of stops) for (const l of s.lines) for (const item of from(l)) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const out = run.filter((s) => s.kind === 'delivery');
  const back = run.filter((s) => s.kind === 'collection');
  const loadOut = tally(out, (l) => accessoryItems(l));
  const loadBack = tally(back, (l) => accessoryItems(l, delivered[l.id]));
  const unitsBack = back.reduce((n, s) => n + s.lines.length, 0);
  const collected = isToday ? doneToday.collections : 0;
  const totalBack = unitsBack + collected;
  const pct = totalBack ? Math.round((collected / totalBack) * 100) : 0;
  const doneStops = isToday ? doneToday.collections + doneToday.deliveries : 0;
  const status = !run.length ? (doneStops ? 'Complete' : 'Quiet day') : !isToday ? 'Planned' : doneStops ? 'In progress' : 'Not started';
  const first = run[0];

  return (
    <section className="h-fit overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[var(--brand-red)]">
          <Package className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">Van load</span>
          <span className="block text-xs text-muted-foreground">Everything for this run, totalled</span>
        </span>
      </div>

      <div className="divide-y">
        <LoadRow icon={ArrowUpFromLine} title="Units going out" empty="No deliveries">
          {out.flatMap((s) => s.lines).map((l) => (
            <UnitChip key={l.id} line={l} />
          ))}
        </LoadRow>
        <LoadRow icon={Package} title="Load on the van" empty="Nothing extra">
          {loadOut.map(([item, n]) => (
            <Count key={item} item={item} n={n} />
          ))}
        </LoadRow>
        <LoadRow icon={ArrowDownToLine} title="Units coming back" empty="No collections">
          {back.flatMap((s) => s.lines).map((l) => (
            <UnitChip key={l.id} line={l} />
          ))}
        </LoadRow>
        <LoadRow icon={Wrench} title="Required accessories" note={loadBack.length ? 'Bring back from site' : undefined} empty="Nothing to bring back">
          {loadBack.map(([item, n]) => (
            <Count key={item} item={item} n={n} />
          ))}
        </LoadRow>

        <div className="flex gap-3 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
            <Box className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">Collected units</p>
            <p className="text-xs text-muted-foreground">
              {collected} of {totalBack} collected
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </span>
              <span className="tabular text-xs text-muted-foreground">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
            <Activity className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">Run status</p>
            <p className="truncate text-xs text-muted-foreground">
              {first ? `${first.kind === 'delivery' ? 'Delivery' : 'Collection'} at ${first.time ?? 'any time'} · ${plural(run.length, 'stop', 'stops')} remaining` : 'No stops left on this run'}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              status === 'In progress' ? 'bg-red-50 text-[var(--brand-red)]' : status === 'Complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'
            )}
          >
            {status}
          </span>
        </div>
      </div>
    </section>
  );
}

function LoadRow({ icon: Icon, title, note, empty, children }: { icon: LucideIcon; title: string; note?: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="flex gap-3 px-5 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {children.length ? (
          <>
            {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

function UnitChip({ line }: { line: Job }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
      <UnitTypeIcon type={line.unit.unitType} className="size-3.5" />
      <UnitCode id={line.unit.id} className="text-xs" />
    </span>
  );
}

function Count({ item, n }: { item: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-600/15 ring-inset">
      <span className="tabular text-[11px] font-semibold">{n}×</span>
      {item}
    </span>
  );
}
