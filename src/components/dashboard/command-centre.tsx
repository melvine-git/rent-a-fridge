'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/app/avatar';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { accessoryItems } from '@/components/jobs/job-drawer';
import { FleetMap, type MapPoint, type RouteLeg } from './fleet-map';
import { STATUS_META, TONE_CLASSES, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, nextServiceDate, powerShort, unitDisplayStatus, type UnitDisplayStatus } from '@/lib/domain';
import { bookingRef, groupVisits } from '@/lib/jobs';
import { daysBetween, daysFromToday, formatDate, formatDayDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpRight, CalendarPlus, Check, Navigation, Phone, Thermometer, TriangleAlert, Wrench, X, Zap } from 'lucide-react';
import type { BookingWithDetails, DeliveryChecklist, Unit } from '@/types';

type LatLng = { lat: number; lng: number };
type Kind = 'delivery' | 'collection';
type StopState = 'done' | 'next' | 'late' | 'todo';

export type CommandCentreProps = {
  today: string;
  tomorrow: string;
  units: Unit[];
  hires: BookingWithDetails[];
  /** Not yet delivered, due up to tomorrow (late ones included) */
  deliveries: BookingWithDetails[];
  /** On hire, due back up to tomorrow (overdue ones included) */
  collections: BookingWithDetails[];
  doneToday: { kind: Kind; at: string; signedBy: string; line: BookingWithDetails }[];
  delivered: Record<string, DeliveryChecklist | undefined>;
  nextOut: Record<string, { date: string; customer: string }>;
  /** Map position by booking line id */
  coords: Record<string, LatLng>;
  yard: (LatLng & { address: string }) | null;
};

type Stop = {
  id: string;
  kind: Kind;
  ref: string;
  lines: BookingWithDetails[];
  due: string;
  time?: string;
  done?: { at: string; signedBy: string };
  state: StopState;
  order: number;
  pos?: LatLng;
  items: string[];
};

const STATUS_ORDER: Record<UnitDisplayStatus, number> = { ON_HIRE: 0, BREAKDOWN: 1, MAINTENANCE: 2, AVAILABLE: 3 };
const FILTERS: { key: 'ALL' | UnitDisplayStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ON_HIRE', label: 'On hire' },
  { key: 'AVAILABLE', label: 'Free' },
  { key: 'MAINTENANCE', label: 'Service' },
  { key: 'BREAKDOWN', label: 'Breakdown' },
];
const SITE_COLOR = { ok: '#0ea5e9', late: '#dc2626', broken: '#f59e0b' };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const mapsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

export function CommandCentre(props: CommandCentreProps) {
  const { today, tomorrow, units, hires, deliveries, collections, doneToday, delivered, nextOut, coords, yard } = props;
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [filter, setFilter] = useState<'ALL' | UnitDisplayStatus>('ALL');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const runs = useMemo(() => {
    const build = (date: string): Stop[] => {
      const isToday = date === today;
      const mk = (kind: Kind, lines: BookingWithDetails[], due: string, time?: string): Omit<Stop, 'state' | 'order'> => ({
        id: `stop-${kind}-${bookingRef(lines[0])}-${due}`,
        kind,
        ref: bookingRef(lines[0]),
        lines,
        due,
        time,
        pos: coords[lines[0].id],
        items: lines.flatMap((l) => accessoryItems(l, kind === 'collection' ? delivered[l.id] : undefined).map((i) => (lines.length > 1 ? `${l.unit.id}: ${i}` : i))),
      });
      const dels = deliveries.filter((b) => (isToday ? b.startDate <= today : b.startDate === date));
      const cols = collections.filter((b) => (isToday ? b.endDate <= today : b.endDate === date));
      const pending = [
        ...groupVisits(dels, (b) => b.startDate).map((l) => mk('delivery', l, l[0].startDate, l[0].deliveryTime)),
        ...groupVisits(cols, (b) => b.endDate).map((l) => mk('collection', l, l[0].endDate, l[0].collectionTime)),
      ].sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.due.localeCompare(b.due));

      const doneGroups = new Map<string, { kind: Kind; at: string; signedBy: string; lines: BookingWithDetails[] }>();
      if (isToday)
        for (const d of doneToday) {
          const key = `${d.kind}-${bookingRef(d.line)}`;
          const g = doneGroups.get(key);
          if (g) g.lines.push(d.line);
          else doneGroups.set(key, { kind: d.kind, at: d.at, signedBy: d.signedBy, lines: [d.line] });
        }
      const done = [...doneGroups.values()]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((g) => ({ ...mk(g.kind, g.lines, today), id: `stop-done-${g.kind}-${bookingRef(g.lines[0])}`, items: [], done: { at: g.at, signedBy: g.signedBy } }));

      return [...done, ...pending].map((s, i) => ({
        ...s,
        order: i + 1,
        state: s.done ? 'done' : isToday && i === done.length ? 'next' : s.due < today ? 'late' : 'todo',
      }));
    };
    return { today: build(today), tomorrow: build(tomorrow) };
  }, [today, tomorrow, deliveries, collections, doneToday, delivered, coords]);

  const run = runs[day];
  const hireOf = useMemo(() => new Map(hires.map((h) => [h.unitId, h])), [hires]);

  // Units out on site, one pin per booking; hidden where a stop on the run already marks the spot
  const sites = useMemo(() => {
    const byRef = new Map<string, BookingWithDetails[]>();
    for (const h of hires) byRef.set(bookingRef(h), [...(byRef.get(bookingRef(h)) ?? []), h]);
    const onRun = new Set(run.map((s) => s.ref));
    return [...byRef.entries()]
      .filter(([ref, lines]) => !onRun.has(ref) && coords[lines[0].id])
      .map(([ref, lines]) => ({ id: `site-${ref}`, ref, lines, pos: coords[lines[0].id] }));
  }, [hires, run, coords]);

  const points: MapPoint[] = useMemo(
    () => [
      ...(yard ? [{ id: 'yard', kind: 'yard' as const, lat: yard.lat, lng: yard.lng, title: 'Yard' }] : []),
      ...sites.map((s) => ({
        id: s.id,
        kind: 'site' as const,
        ...s.pos,
        count: s.lines.length,
        title: `${s.lines[0].customer.name} · ${s.lines.map((l) => l.unit.id).join(', ')}`,
        color: s.lines.some((l) => l.unit.breakdown) ? SITE_COLOR.broken : s.lines.some((l) => l.endDate < today) ? SITE_COLOR.late : SITE_COLOR.ok,
      })),
      ...run
        .filter((s) => s.pos)
        .map((s) => ({ id: s.id, kind: 'stop' as const, ...s.pos!, order: s.order, state: s.state, title: `${s.order}. ${s.lines[0].customer.name}` })),
    ],
    [yard, sites, run, today]
  );

  const route: RouteLeg[] = useMemo(() => {
    if (!yard) return [];
    const placed = run.filter((s) => s.pos);
    if (!placed.length) return [];
    const legs: RouteLeg[] = [];
    let from: [number, number] = [yard.lat, yard.lng];
    for (const s of placed) {
      const to: [number, number] = [s.pos!.lat, s.pos!.lng];
      legs.push({ from, to, done: !!s.done });
      from = to;
    }
    legs.push({ from, to: [yard.lat, yard.lng], done: placed.every((s) => s.done) });
    return legs;
  }, [yard, run]);

  const unit = unitId ? units.find((u) => u.id === unitId) : undefined;
  const unitHire = unit ? hireOf.get(unit.id) : undefined;
  const activeId = unit
    ? unitHire
      ? (sites.find((s) => s.ref === bookingRef(unitHire))?.id ?? run.find((s) => s.ref === bookingRef(unitHire))?.id ?? null)
      : null
    : stopId;

  const onMapSelect = (id: string) => {
    if (id.startsWith('site-')) {
      const s = sites.find((x) => x.id === id);
      if (s) setUnitId(s.lines[0].unit.id);
    } else if (id.startsWith('stop-')) {
      setUnitId(null);
      setStopId((cur) => (cur === id ? null : id));
    }
  };

  const counts = {
    ALL: units.length,
    ON_HIRE: units.filter((u) => unitDisplayStatus(u) === 'ON_HIRE').length,
    AVAILABLE: units.filter((u) => unitDisplayStatus(u) === 'AVAILABLE').length,
    MAINTENANCE: units.filter((u) => unitDisplayStatus(u) === 'MAINTENANCE').length,
    BREAKDOWN: units.filter((u) => unitDisplayStatus(u) === 'BREAKDOWN').length,
  };
  const list = units
    .filter((u) => filter === 'ALL' || unitDisplayStatus(u) === filter)
    .sort((a, b) => STATUS_ORDER[unitDisplayStatus(a)] - STATUS_ORDER[unitDisplayStatus(b)] || a.id.localeCompare(b.id));
  const unplaced = run.filter((s) => !s.pos).length + hires.filter((h) => !coords[h.id]).length;

  const panel = 'flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)]';

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-stone-100 lg:h-[clamp(640px,calc(100dvh-150px),860px)]" aria-label="Fleet and today's run">
      {/* Map with its overlays */}
      <div className="relative h-[340px] sm:h-[420px] lg:absolute lg:inset-0 lg:h-auto">
        <FleetMap points={points} route={route} activeId={activeId} onSelect={onMapSelect} fitKey={day} className="absolute inset-0" controlsClassName="right-3 bottom-3 lg:right-[404px] lg:bottom-4" />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center lg:right-[404px] lg:left-[372px] lg:top-4">
          <div className="pointer-events-auto flex items-center divide-x rounded-full border bg-white/95 text-xs shadow-[var(--shadow-md)] backdrop-blur">
            <span className="flex items-center gap-2 px-3.5 py-2 font-medium text-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live
              <span className="tabular font-normal text-muted-foreground">{now ? `${formatDayDate(now)} · ${hhmm(now.toISOString())}` : formatDayDate(today)}</span>
            </span>
            <span className="hidden px-3.5 py-2 text-muted-foreground sm:inline">
              On hire <b className="tabular font-semibold text-foreground">{counts.ON_HIRE}</b>
            </span>
            <span className="hidden px-3.5 py-2 text-muted-foreground xl:inline">
              Free <b className="tabular font-semibold text-emerald-600">{counts.AVAILABLE}</b>
            </span>
            <span className="px-3.5 py-2 text-muted-foreground">
              Jobs today <b className="tabular font-semibold text-foreground">{runs.today.length}</b>
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex right-16 lg:right-[404px] lg:left-[372px] lg:bottom-4 lg:justify-center">
          <ul className="pointer-events-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-full border bg-white/95 px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-[var(--shadow-md)] backdrop-blur">
            <Key swatch={<span className="size-2.5 rounded-[3px] bg-stone-900" />}>Yard</Key>
            <Key swatch={<span className="size-2.5 rounded-full border-2 border-stone-900 bg-white" />}>Stop</Key>
            <Key swatch={<span className="size-2.5 rounded-full bg-[var(--brand-red)]" />}>Next</Key>
            <Key swatch={<span className="size-2.5 rounded-full bg-sky-500" />}>On site</Key>
            <Key swatch={<span className="size-2.5 rounded-full bg-red-600" />}>Overdue</Key>
            {unplaced > 0 && <li className="text-amber-700">{unplaced} without a postcode</li>}
          </ul>
        </div>
      </div>

      {/* Panels: floating over the map on wide screens, stacked below it on small ones */}
      <div className="grid gap-3 p-3 md:grid-cols-2 lg:contents">
        {/* Fleet */}
        <aside className={cn(panel, 'max-h-[460px] lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:z-10 lg:max-h-none lg:w-[340px]')}>
          <header className="px-4 pt-4 pb-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">
                Fleet <span className="ml-1 text-xs font-normal text-muted-foreground">{plural(units.length, 'unit')}</span>
              </h2>
              <Link href="/units" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FILTERS.filter((f) => f.key === 'ALL' || counts[f.key] > 0).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                    filter === f.key ? 'border-stone-900 bg-stone-900 text-white' : 'bg-white text-foreground hover:bg-muted'
                  )}
                >
                  {f.label} <span className={cn('tabular ml-0.5', filter === f.key ? 'text-white/70' : 'text-muted-foreground')}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          </header>
          <ul className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t px-2 py-2">
            {list.map((u) => (
              <li key={u.id}>
                <UnitRow unit={u} hire={hireOf.get(u.id)} next={nextOut[u.id]} today={today} active={u.id === unitId} onClick={() => setUnitId((cur) => (cur === u.id ? null : u.id))} />
              </li>
            ))}
          </ul>
        </aside>

        {/* Run or unit detail */}
        <aside className={cn(panel, 'max-h-[640px] lg:absolute lg:top-4 lg:right-4 lg:bottom-4 lg:z-10 lg:max-h-none lg:w-[372px]')}>
          {unit ? (
            <UnitPanel unit={unit} hire={unitHire} next={nextOut[unit.id]} left={unitHire ? delivered[unitHire.id] : undefined} today={today} onClose={() => setUnitId(null)} />
          ) : (
            <RunPanel run={run} day={day} setDay={setDay} today={today} tomorrow={tomorrow} now={now} yard={yard} activeId={stopId} onSelect={(id) => setStopId((cur) => (cur === id ? null : id))} />
          )}
        </aside>
      </div>
    </section>
  );
}

function Key({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      {swatch}
      {children}
    </li>
  );
}

function UnitRow({
  unit,
  hire,
  next,
  today,
  active,
  onClick,
}: {
  unit: Unit;
  hire?: BookingWithDetails;
  next?: { date: string; customer: string };
  today: string;
  active: boolean;
  onClick: () => void;
}) {
  const status = unitDisplayStatus(unit);
  const meta = STATUS_META[status];
  const overdue = !!hire && hire.endDate < today;
  const total = hire ? daysBetween(hire.startDate, hire.endDate) : 0;
  const elapsed = hire ? Math.min(total, Math.max(0, daysBetween(hire.startDate, today))) : 0;
  const sub = hire ? hire.customer.name : unit.breakdown ? unit.breakdown.notes || 'Broken down' : status === 'MAINTENANCE' ? unit.notes || 'In the workshop' : next ? `Free · out ${formatDate(next.date)}` : 'In the yard';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
        active ? 'bg-red-50/80' : 'hover:bg-muted/60'
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--brand-red)]" />}
      <UnitTypeIcon type={unit.unitType} boxed className="size-9 rounded-full" />
      <span className="min-w-0">
        <span className="font-mono-unit block text-[13px] font-semibold text-foreground">{unit.id}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      <span className="text-right">
        <span className={cn('tabular block text-[13px] font-semibold', overdue ? 'text-red-600' : 'text-foreground')}>{hire ? formatDate(hire.endDate) : '—'}</span>
        <span className={cn('block text-[11px] font-medium', overdue ? 'text-red-600' : TONE_CLASSES[meta.tone].text)}>{overdue ? 'Overdue' : meta.label}</span>
      </span>
      {hire && (
        <span className="col-span-3 col-start-2 mt-1.5 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200">
            <span className={cn('block h-full rounded-full', overdue ? 'bg-red-500' : 'bg-stone-800')} style={{ width: `${total ? (elapsed / total) * 100 : 0}%` }} />
          </span>
          <span className="tabular text-[10px] text-muted-foreground">
            {elapsed}/{total}
          </span>
        </span>
      )}
    </button>
  );
}

function untilLabel(time: string | undefined, now: Date | null) {
  if (!time || !now) return { big: time ?? 'Any', small: time ? '' : 'time today' };
  const [h, m] = time.split(':').map(Number);
  const mins = Math.round((new Date(now).setHours(h, m, 0, 0) - now.getTime()) / 60_000);
  const fmt = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`.trim() : `${n} min`);
  return mins >= 0 ? { big: fmt(mins), small: `ETA ${time}` } : { big: time, small: `${fmt(-mins)} behind` };
}

function RunPanel({
  run,
  day,
  setDay,
  today,
  tomorrow,
  now,
  yard,
  activeId,
  onSelect,
}: {
  run: Stop[];
  day: 'today' | 'tomorrow';
  setDay: (d: 'today' | 'tomorrow') => void;
  today: string;
  tomorrow: string;
  now: Date | null;
  yard: CommandCentreProps['yard'];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const done = run.filter((s) => s.done).length;
  const next = run.find((s) => s.state === 'next') ?? (day === 'tomorrow' ? run[0] : undefined);
  const out = run.filter((s) => s.kind === 'delivery' && !s.done).reduce((n, s) => n + s.lines.length, 0);
  const back = run.filter((s) => s.kind === 'collection' && !s.done).reduce((n, s) => n + s.lines.length, 0);
  const items = run.filter((s) => !s.done).reduce((n, s) => n + s.items.length, 0);
  const status = !run.length ? 'Quiet day' : done === run.length ? 'Run complete' : day === 'tomorrow' ? 'Planned' : done ? 'On the road' : 'Not started';
  const statusCls = !run.length || done === run.length ? 'bg-emerald-50 text-emerald-700' : done ? 'bg-sky-50 text-sky-700' : 'bg-stone-100 text-stone-700';
  const pending = run.filter((s) => !s.done);
  const routeUrl =
    pending.length > 0
      ? `https://www.google.com/maps/dir/?api=1${yard ? `&origin=${encodeURIComponent(yard.address)}` : ''}&destination=${encodeURIComponent(pending.at(-1)!.lines[0].deliveryAddress)}${
          pending.length > 1 ? `&waypoints=${encodeURIComponent(pending.slice(0, -1).map((s) => s.lines[0].deliveryAddress).join('|'))}` : ''
        }`
      : null;
  const eta = next && day === 'today' ? untilLabel(next.time, now) : null;

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap text-foreground">{day === 'today' ? "Today's run" : "Tomorrow's run"}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', statusCls)}>{status}</span>
            {formatDayDate(day === 'today' ? today : tomorrow)} · {run.length ? plural(run.length, 'stop') : 'No jobs'}
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg bg-muted p-0.5 text-xs font-medium">
          {(['today', 'tomorrow'] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDay(d)} className={cn('rounded-md px-2.5 py-1 capitalize transition-colors', day === d ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {d}
            </button>
          ))}
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {next ? (
          <div className="rounded-xl border bg-stone-50/70 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{day === 'today' ? 'Next stop' : 'First stop'}</p>
                <p className="mt-0.5 truncate text-[15px] font-semibold text-foreground">{next.lines[0].customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {next.kind === 'delivery' ? 'Deliver' : 'Collect'} {next.lines.map((l) => l.unit.id).join(' + ')} · {next.lines[0].deliveryAddress}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-xl leading-none font-semibold text-[var(--brand-red)]">{eta ? eta.big : (next.time ?? 'Any')}</p>
                <p className={cn('mt-1 text-[11px]', next.due < today ? 'font-medium text-red-600' : 'text-muted-foreground')}>{next.due < today ? `Due ${formatDate(next.due)}` : (eta?.small ?? 'scheduled')}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1">
              {run.map((s) => (
                <span key={s.id} className={cn('h-1 flex-1 rounded-full', s.done ? 'bg-stone-900' : s === next ? 'bg-[var(--brand-red)]' : 'bg-stone-200')} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center">
            <Check className="mx-auto size-5 text-emerald-600" />
            <p className="mt-1.5 text-sm font-medium text-foreground">{run.length ? 'Every stop is done' : 'Nothing on the run'}</p>
            <p className="text-xs text-muted-foreground">{run.length ? 'All jobs signed off.' : 'The van can stay in the yard.'}</p>
          </div>
        )}

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Tile label="Going out" value={plural(out, 'unit')} />
          <Tile label="Coming back" value={plural(back, 'unit')} />
          <Tile label="Accessories" value={items} />
        </dl>

        {run.length > 0 && (
          <>
            <div className="mt-5 mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-foreground">Stops</h3>
              <span className="tabular text-xs text-muted-foreground">
                {done} of {run.length} done
              </span>
            </div>
            <ol className="relative">
              <span className="absolute top-3 bottom-3 left-[9px] w-px bg-stone-200" aria-hidden />
              <TimelineRow marker={<span className="size-2.5 rounded-[3px] bg-stone-900" />} title="Yard" sub={day === 'today' ? 'Load up and leave' : 'Start of the run'} />
              {run.map((s) => (
                <StopItem key={s.id} stop={s} today={today} active={s.id === activeId} onSelect={() => onSelect(s.id)} />
              ))}
              <TimelineRow marker={<span className="size-2.5 rounded-[3px] border-2 border-stone-900 bg-white" />} title="Back to yard" sub={back ? `Unload ${plural(back, 'unit')}` : 'End of the run'} />
            </ol>
          </>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t px-5 py-3.5">
        <Link href="/deliveries" className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-800">
          Open dispatch
        </Link>
        {routeUrl ? (
          <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">
            <Navigation className="size-4" /> Full route
          </a>
        ) : (
          <Link href="/bookings/new" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">
            <CalendarPlus className="size-4" /> New booking
          </Link>
        )}
      </footer>
    </>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function TimelineRow({ marker, title, sub }: { marker: React.ReactNode; title: string; sub: string }) {
  return (
    <li className="relative flex items-center gap-3 py-2">
      <span className="relative z-10 flex size-5 items-center justify-center bg-white">{marker}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </li>
  );
}

function StopItem({ stop: s, today, active, onSelect }: { stop: Stop; today: string; active: boolean; onSelect: () => void }) {
  const b = s.lines[0];
  const units = s.lines.map((l) => l.unit.id).join(' + ');
  const late = !s.done && s.due < today;
  const sub = s.done
    ? `${s.kind === 'delivery' ? 'Delivered' : 'Collected'} ${units}${s.done.signedBy ? ` · signed ${s.done.signedBy}` : ''}`
    : `${s.kind === 'delivery' ? 'Deliver' : 'Collect'} ${units}${late ? ` · was due ${formatDate(s.due)}` : ''}`;
  const time = s.done ? hhmm(s.done.at) : (s.time ?? 'Any');

  return (
    <li className="relative">
      <button type="button" onClick={onSelect} aria-expanded={active} className={cn('flex w-full items-start gap-3 rounded-lg py-2 pr-1 text-left transition-colors', active ? 'bg-stone-50' : 'hover:bg-stone-50/70')}>
        <span className="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center bg-white">
          {s.state === 'done' ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
          ) : s.state === 'next' ? (
            <span className="flex size-5 items-center justify-center rounded-full border-2 border-[var(--brand-red)] bg-white">
              <span className="size-2 rounded-full bg-[var(--brand-red)]" />
            </span>
          ) : (
            <span className={cn('tabular flex size-5 items-center justify-center rounded-full border-2 bg-white text-[10px] font-bold', late ? 'border-red-500 text-red-600' : 'border-stone-300 text-stone-500')}>{s.order}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">{b.customer.name}</span>
          <span className={cn('block truncate text-xs', late ? 'text-red-600' : 'text-muted-foreground')}>{sub}</span>
        </span>
        <span className={cn('tabular shrink-0 text-xs font-medium', s.state === 'next' ? 'text-[var(--brand-red)]' : 'text-muted-foreground')}>{time}</span>
      </button>
      {active && (
        <div className="mb-2 ml-8 space-y-2 rounded-lg border bg-white p-3 text-xs">
          <p className="text-muted-foreground">{b.deliveryAddress}</p>
          {(b.contactName || b.contactPhone) && (
            <p className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{b.contactName || 'Site contact'}</span>
              {b.contactPhone && (
                <a href={`tel:${b.contactPhone}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                  <Phone className="size-3" /> {formatPhone(b.contactPhone)}
                </a>
              )}
            </p>
          )}
          {s.items.length > 0 && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{s.kind === 'delivery' ? 'Load: ' : 'Bring back: '}</span>
              {s.items.join(', ')}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Link href={`/bookings/${s.ref}`} className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 font-medium hover:bg-muted">
              Open booking <ArrowUpRight className="size-3" />
            </Link>
            {!s.done && (
              <a href={mapsUrl(b.deliveryAddress)} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 font-medium hover:bg-muted">
                <Navigation className="size-3" /> Navigate
              </a>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function UnitPanel({
  unit,
  hire,
  next,
  left,
  today,
  onClose,
}: {
  unit: Unit;
  hire?: BookingWithDetails;
  next?: { date: string; customer: string };
  left?: DeliveryChecklist;
  today: string;
  onClose: () => void;
}) {
  const status = unitDisplayStatus(unit);
  const meta = STATUS_META[status];
  const overdue = !!hire && hire.endDate < today;
  const total = hire ? daysBetween(hire.startDate, hire.endDate) : 0;
  const elapsed = hire ? Math.min(total, Math.max(0, daysBetween(hire.startDate, today))) : 0;
  const daysLeft = hire ? daysFromToday(hire.endDate) : 0;
  const service = nextServiceDate(unit);
  const capacity = unit.specifications?.cubicCapacity;
  const onSite = hire ? accessoryItems(hire, left) : [];

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono-unit text-lg font-semibold tracking-tight text-foreground">{unit.id}</h2>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', overdue ? TONE_CLASSES.danger.badge : TONE_CLASSES[meta.tone].badge)}>{overdue ? 'Overdue' : meta.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {UNIT_TYPE_LABELS[unit.unitType]} · {UNIT_SIZE_LABELS[unit.size]}
            {capacity ? ` · ${capacity} m³` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted" aria-label="Back to the run">
          <X className="size-4" />
        </button>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-4">
        {unit.breakdown && (
          <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Broken down since {formatDate(unit.breakdown.reportedAt)}</p>
              {unit.breakdown.notes && <p className="mt-0.5">{unit.breakdown.notes}</p>}
            </div>
          </div>
        )}

        {hire ? (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
              <Avatar name={hire.customer.name} className="rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{hire.customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{hire.contactName ? `Site contact: ${hire.contactName}` : `On hire since ${formatDate(hire.startDate)}`}</p>
              </div>
              {hire.contactPhone && (
                <a href={`tel:${hire.contactPhone}`} className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-white hover:bg-muted" aria-label={`Call ${formatPhone(hire.contactPhone)}`}>
                  <Phone className="size-3.5" />
                </a>
              )}
            </div>

            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Due back</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-foreground">{formatDayDate(hire.endDate)}</p>
                </div>
                <p className={cn('tabular text-xl leading-none font-semibold', overdue ? 'text-red-600' : 'text-[var(--brand-red)]')}>
                  {overdue ? `${-daysLeft}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                </p>
              </div>
              <div className="mt-2.5 flex gap-1">
                {Array.from({ length: Math.min(total, 28) }, (_, i) => (
                  <span key={i} className={cn('h-1 flex-1 rounded-full', i < Math.round((elapsed / total) * Math.min(total, 28)) ? (overdue ? 'bg-red-500' : 'bg-stone-900') : 'bg-stone-200')} />
                ))}
              </div>
              <p className="tabular mt-1.5 text-[11px] text-muted-foreground">
                Day {elapsed} of {total} · out {formatDate(hire.startDate)}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2">
              <Tile label="Temp" value={<span className="inline-flex items-center gap-1"><Thermometer className="size-3.5 text-sky-600" />{hire.tempRequired}°C</span>} />
              <Tile label="Power" value={<span className="inline-flex items-center gap-1"><Zap className="size-3.5 text-amber-500" />{powerShort(hire)}</span>} />
              <Tile label="Cable" value={hire.cableLength ?? '—'} />
            </dl>

            <div className="space-y-1.5 text-xs">
              <p className="font-medium text-foreground">Site</p>
              <p className="text-muted-foreground">{hire.deliveryAddress}</p>
              {onSite.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Left on site: </span>
                  {onSite.join(', ')}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-stone-50 p-3.5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{status === 'AVAILABLE' ? 'In the yard' : 'Out of action'}</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {status !== 'AVAILABLE' ? (unit.notes || meta.label) : next ? `Free until ${formatDayDate(next.date)}` : 'Free, nothing booked'}
              </p>
              {next && <p className="text-xs text-muted-foreground">Next out to {next.customer}</p>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs">
          <Wrench className="size-4 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">Next service</span>
          <span className={cn('font-medium', service && service < today ? 'text-red-600' : 'text-foreground')}>{service ? formatDate(service) : 'Not scheduled'}</span>
        </div>
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t px-5 py-3.5">
        {hire ? (
          <Link href={`/bookings/${bookingRef(hire)}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-800">
            Open booking
          </Link>
        ) : status === 'AVAILABLE' ? (
          <Link href={`/bookings/new?unit=${encodeURIComponent(unit.id)}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-800">
            <CalendarPlus className="size-4" /> Book {unit.id}
          </Link>
        ) : (
          <Link href={`/units/${unit.id}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-800">
            Manage unit
          </Link>
        )}
        <Link href={`/units/${unit.id}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">
          Unit details <ArrowUpRight className="size-3.5" />
        </Link>
      </footer>
    </>
  );
}
