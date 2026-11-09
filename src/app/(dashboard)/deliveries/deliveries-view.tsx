'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KpiDrilldown } from '@/components/app/kpi-drilldown';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { JobDrawer, accessoryItems, type JobTarget, type JobType } from '@/components/jobs/job-drawer';
import { powerShort } from '@/lib/domain';
import { bookingRef, groupVisits, visitOf } from '@/lib/jobs';
import { daysFromToday, formatDate, formatPhone, w3wUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingWithDetails, DeliveryChecklist, Staff } from '@/types';
import { ArrowUpRight, Box, CalendarCheck, CalendarClock, CircleCheck, Navigation, Package, PackageCheck, PenLine, Phone, Thermometer, TriangleAlert, Truck, Zap } from 'lucide-react';

type Job = BookingWithDetails;
type Stop = { key: string; kind: JobType; date: string; time?: string; lines: Job[]; overdue: boolean };
type Completed = { id: string; type: 'DELIVERY' | 'COLLECTION'; unitId: string; customer: string; signedBy: string; hasSignature: boolean; completedAt: string; href: string };

interface DeliveriesViewProps {
  today: string;
  deliveries: Job[];
  collections: Job[];
  onHire: Job[];
  delivered: Record<string, DeliveryChecklist | undefined>;
  completed: Completed[];
  staff: Staff[];
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

export function DeliveriesView({ today, deliveries, collections, onHire, delivered, completed, staff }: DeliveriesViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const [day, setDay] = useState(today);
  const tomorrow = addDays(today, 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const stops: Stop[] = [
    ...groupVisits(deliveries, byStart).map((lines) => ({ kind: 'delivery' as const, lines, date: lines[0].startDate, time: lines[0].deliveryTime })),
    ...groupVisits(collections, byEnd).map((lines) => ({ kind: 'collection' as const, lines, date: lines[0].endDate, time: lines[0].collectionTime })),
  ].map((s) => ({ ...s, key: `${s.kind}-${s.lines[0].id}`, overdue: s.date < today, date: s.date < today ? today : s.date }));
  const stopsOn = (d: string) =>
    stops
      .filter((s) => s.date === d)
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.kind.localeCompare(b.kind));
  const run = stopsOn(day);
  const overdueCount = stops.filter((s) => s.overdue).length;

  const open = (lines: Job[], type: JobType) => setJob({ bookings: lines, type, delivered });
  const toItems = (list: Stop[]) =>
    list.map((s) => ({
      key: s.key,
      href: `/bookings/${bookingRef(s.lines[0])}`,
      title: s.lines[0].customer.name,
      subtitle: `${s.lines.map((l) => l.unit.id).join(', ')} · ${s.lines[0].deliveryAddress}`,
      meta: s.overdue ? 'Overdue' : s.time ?? formatDate(s.date),
    }));

  return (
    <div className="space-y-6">
      <KpiDrilldown
        cards={[
          {
            key: 'today',
            label: 'Deliveries today',
            icon: Truck,
            tone: 'scheduled',
            hint: stops.some((s) => s.kind === 'delivery' && s.overdue) ? `incl. ${stops.filter((s) => s.kind === 'delivery' && s.overdue).length} late` : undefined,
            items: toItems(stopsOn(today).filter((s) => s.kind === 'delivery')),
            emptyText: 'No deliveries today',
          },
          { key: 'tomorrow', label: 'Deliveries tomorrow', icon: CalendarClock, tone: 'neutral', items: toItems(stopsOn(tomorrow).filter((s) => s.kind === 'delivery')), emptyText: 'Nothing scheduled for tomorrow' },
          {
            key: 'due',
            label: 'Collections due',
            icon: PackageCheck,
            tone: stops.some((s) => s.kind === 'collection' && s.overdue) ? 'danger' : 'warning',
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
            })),
            emptyText: 'No units on hire',
          },
        ]}
      />

      {/* Day rail */}
      <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {days.map((d) => {
          const list = stopsOn(d);
          const active = d === day;
          const hasOverdue = list.some((s) => s.overdue);
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={active}
              className={cn(
                'flex min-w-[92px] shrink-0 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                active ? 'border-foreground bg-foreground text-background shadow-[var(--shadow-md)]' : 'bg-white hover:border-foreground/20 hover:shadow-[var(--shadow-sm)]'
              )}
            >
              <span className={cn('text-[11px] font-medium uppercase tracking-wide', active ? 'text-background/70' : 'text-muted-foreground')}>
                {d === today ? 'Today' : d === tomorrow ? 'Tomorrow' : dayLabel(d, { weekday: 'short' })}
              </span>
              <span className="tabular text-sm font-semibold">{dayLabel(d, { day: 'numeric', month: 'short' })}</span>
              <span className={cn('mt-1 inline-flex items-center gap-1 text-xs', active ? 'text-background/80' : list.length ? 'text-foreground' : 'text-muted-foreground')}>
                {hasOverdue && <span className="size-1.5 rounded-full bg-red-500" />}
                {list.length ? `${list.length} stop${list.length > 1 ? 's' : ''}` : 'No stops'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Run */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)] lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                {day === today ? "Today's run" : day === tomorrow ? "Tomorrow's run" : `Run for ${dayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                {run.length
                  ? `${plural(run.filter((s) => s.kind === 'delivery').length, 'delivery', 'deliveries')} · ${plural(run.filter((s) => s.kind === 'collection').length, 'collection', 'collections')}${day === today && overdueCount ? ` · ${overdueCount} overdue carried over` : ''}`
                  : 'Deliveries and collections in time order'}
              </p>
            </div>
          </header>
          {run.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border-t px-5 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CalendarCheck className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Nothing on the run</p>
              <p className="max-w-xs text-xs text-muted-foreground">No deliveries or collections for this day. Pick another day above to plan ahead.</p>
            </div>
          ) : (
            <ol className="border-t">
              {run.map((s, i) => (
                <StopRow key={s.key} stop={s} index={i + 1} delivered={delivered} onAction={() => open(s.lines, s.kind)} />
              ))}
            </ol>
          )}
        </section>

        {/* Van load */}
        <VanLoad run={run} delivered={delivered} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5 xl:gap-6">
        {/* On hire */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)] xl:col-span-3">
          <header className="flex items-center gap-2 px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold text-foreground">On hire</h2>
            <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{onHire.length}</span>
            <span className="ml-1 text-xs text-muted-foreground">Units currently with customers</span>
          </header>
          {onHire.length === 0 ? (
            <p className="border-t px-5 py-6 text-sm text-muted-foreground">No units on hire.</p>
          ) : (
            <ul className="divide-y border-t">
              {[...onHire]
                .sort((a, b) => a.endDate.localeCompare(b.endDate))
                .map((h) => {
                  const d = daysFromToday(h.endDate);
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                      <UnitTypeIcon type={h.unit.unitType} boxed />
                      <Link href={`/bookings/${bookingRef(h)}`} className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm">
                          <UnitCode id={h.unit.id} />
                          <span className="truncate text-foreground hover:underline">{h.customer.name}</span>
                        </p>
                        <p className={cn('text-xs', d < 0 ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                          {d < 0 ? `Collection ${-d}d overdue` : d === 0 ? 'Collection due today' : `Back ${formatDate(h.endDate)} · in ${d} day${d > 1 ? 's' : ''}`}
                        </p>
                      </Link>
                      <button
                        onClick={() => open(visitOf(h, onHire, byEnd), 'collection')}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium hover:bg-muted"
                      >
                        <PackageCheck className="size-3.5" /> Collect
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        {/* Recently completed */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)] xl:col-span-2">
          <header className="flex items-center gap-2 px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold text-foreground">Recently completed</h2>
          </header>
          {completed.length === 0 ? (
            <p className="border-t px-5 py-6 text-sm text-muted-foreground">No completed jobs yet.</p>
          ) : (
            <ul className="divide-y border-t">
              {completed.map((d) => (
                <li key={d.id}>
                  <Link href={d.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', d.type === 'DELIVERY' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700')}>
                      {d.type === 'DELIVERY' ? <Truck className="size-3.5" /> : <CircleCheck className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm">
                        <UnitCode id={d.unitId} />
                        <span className="truncate text-muted-foreground">
                          {d.type === 'DELIVERY' ? 'to' : 'from'} {d.customer}
                        </span>
                      </p>
                      {d.signedBy && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {d.hasSignature && <PenLine className="size-3 shrink-0 text-emerald-600" aria-label="Signature captured" />}
                          Signed by {d.signedBy}
                        </p>
                      )}
                    </div>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">{formatDate(d.completedAt.split('T')[0])}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
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

function StopRow({ stop, index, delivered, onAction }: { stop: Stop; index: number; delivered: Record<string, DeliveryChecklist | undefined>; onAction: () => void }) {
  const b = stop.lines[0];
  const isDelivery = stop.kind === 'delivery';
  const items = stop.lines.flatMap((l) => accessoryItems(l, isDelivery ? undefined : delivered[l.id]).map((i) => (stop.lines.length > 1 ? `${l.unit.id}: ${i}` : i)));
  const temps = [...new Set(stop.lines.map((l) => `${l.tempRequired}°C`))].join(' / ');
  const mapHref = b.what3wordsAddress ? w3wUrl(b.what3wordsAddress) : `https://maps.google.com/?q=${encodeURIComponent(b.deliveryAddress)}`;
  const accent = stop.overdue ? 'bg-red-500' : isDelivery ? 'bg-violet-500' : 'bg-amber-500';

  return (
    <li className={cn('relative grid grid-cols-[44px_1fr] gap-x-4 border-b px-5 py-4 last:border-b-0 sm:grid-cols-[56px_1fr_auto]', stop.overdue && 'bg-red-50/40')}>
      <span className={cn('absolute inset-y-0 left-0 w-1', accent)} />
      {/* Time + sequence */}
      <div className="flex flex-col items-start">
        <span className="tabular text-[15px] leading-tight font-semibold text-foreground">{stop.time ?? 'Any'}</span>
        <span className="tabular mt-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{index}</span>
      </div>

      {/* Details */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              stop.overdue ? 'bg-red-100 text-red-700' : isDelivery ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-800'
            )}
          >
            {stop.overdue && <TriangleAlert className="size-3" />}
            {isDelivery ? 'Delivery' : 'Collection'}
            {stop.overdue && ` · was due ${formatDate(isDelivery ? b.startDate : b.endDate)}`}
          </span>
          <Link href={`/bookings/${bookingRef(b)}`} className="truncate text-sm font-semibold text-foreground hover:underline">
            {b.customer.name}
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
          <a href={`tel:${b.contactPhone}`} className="inline-flex items-center gap-1 hover:text-foreground">
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
              <span key={i} className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 ring-1 ring-amber-600/15 ring-inset">
                {i}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="col-span-2 mt-3 flex items-center gap-2 sm:col-span-1 sm:mt-0 sm:flex-col sm:items-stretch">
        <button
          onClick={onAction}
          className={cn(
            'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition-colors sm:flex-none',
            isDelivery ? 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]' : 'bg-emerald-600 hover:bg-emerald-700'
          )}
        >
          {isDelivery ? <Truck className="size-4" /> : <PackageCheck className="size-4" />}
          {isDelivery ? 'Deliver' : 'Collect'}
          {stop.lines.length > 1 && <span className="text-white/80">({stop.lines.length})</span>}
        </button>
        <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-muted">
          <Navigation className="size-4" /> Navigate
        </a>
      </div>
    </li>
  );
}

/** What has to go on the van for the selected day, and what comes back. */
function VanLoad({ run, delivered }: { run: Stop[]; delivered: Record<string, DeliveryChecklist | undefined> }) {
  const tally = (stops: Stop[], from: (l: Job) => string[]) => {
    const counts = new Map<string, number>();
    for (const s of stops) for (const l of s.lines) for (const item of from(l)) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const out = run.filter((s) => s.kind === 'delivery');
  const back = run.filter((s) => s.kind === 'collection');
  const loadOut = tally(out, (l) => accessoryItems(l));
  const loadBack = tally(back, (l) => accessoryItems(l, delivered[l.id]));

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold text-foreground">Van load</h2>
        <p className="text-xs text-muted-foreground">Everything for this run, totalled</p>
      </header>
      <div className="space-y-5 border-t p-5">
        <LoadGroup title="Units going out" empty="No deliveries">
          {out.flatMap((s) => s.lines).map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
              <UnitTypeIcon type={l.unit.unitType} className="size-3.5" />
              <UnitCode id={l.unit.id} className="text-xs" />
            </span>
          ))}
        </LoadGroup>
        <LoadGroup title="Load on the van" empty="Nothing extra">
          {loadOut.map(([item, n]) => (
            <Count key={item} item={item} n={n} />
          ))}
        </LoadGroup>
        <LoadGroup title="Units coming back" empty="No collections">
          {back.flatMap((s) => s.lines).map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1">
              <UnitTypeIcon type={l.unit.unitType} className="size-3.5" />
              <UnitCode id={l.unit.id} className="text-xs" />
            </span>
          ))}
        </LoadGroup>
        <LoadGroup title="Bring back" empty="Nothing extra">
          {loadBack.map(([item, n]) => (
            <Count key={item} item={item} n={n} />
          ))}
        </LoadGroup>
      </div>
      <Link href="/collections" className="flex items-center justify-between border-t bg-muted/30 px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        All collections <ArrowUpRight className="size-3.5" />
      </Link>
    </section>
  );
}

function LoadGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children.length ? <div className="flex flex-wrap gap-1.5">{children}</div> : <p className="text-xs text-muted-foreground/80">{empty}</p>}
    </div>
  );
}

function Count({ item, n }: { item: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-600/15 ring-inset">
      <span className="tabular rounded bg-white px-1 text-[11px] font-semibold">{n}×</span>
      {item}
    </span>
  );
}
