'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/status-badge';
import { KpiDrilldown } from '@/components/app/kpi-drilldown';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { JobDrawer, accessoryItems, type JobTarget, type JobType } from '@/components/jobs/job-drawer';
import { powerShort } from '@/lib/domain';
import { bookingRef, groupVisits, visitOf } from '@/lib/jobs';
import { daysFromToday, formatDate, formatDayDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Booking, Customer, Unit, Staff, DeliveryDocket, BookingWithDetails, DeliveryChecklist } from '@/types';
import { CalendarClock, CircleCheck, Clock, MapPin, Package, PackageCheck, PenLine, Thermometer, Truck, Zap, Box } from 'lucide-react';

type JobWithDetails = BookingWithDetails;
type DocketWithDetails = DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff };

interface DeliveriesViewProps {
  tomorrowDeliveries: JobWithDetails[];
  todayDeliveries: JobWithDetails[];
  activeHires: JobWithDetails[];
  collectionsDue: JobWithDetails[];
  staff: Staff[];
  allDockets: DocketWithDetails[];
  upcomingDockets: DocketWithDetails[];
}

const byStart = (b: Booking) => b.startDate;
const byEnd = (b: Booking) => b.endDate;

export function DeliveriesView({
  tomorrowDeliveries,
  todayDeliveries,
  activeHires,
  collectionsDue,
  staff,
  allDockets,
  upcomingDockets,
}: DeliveriesViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const [[todayDate, tomorrowDate]] = useState(() => {
    const t = new Date();
    const n = new Date(t);
    n.setDate(n.getDate() + 1);
    return [t, n] as const;
  });
  const boardIds = new Set([...todayDeliveries, ...tomorrowDeliveries].map((b) => b.id));
  const comingUp = upcomingDockets.filter((d) => d.booking.status === 'CONFIRMED' && !boardIds.has(d.bookingId));

  const completedDockets = allDockets
    .filter((d) => d.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? b.scheduledDate).localeCompare(a.completedAt ?? a.scheduledDate));
  const dueIds = new Set(collectionsDue.map((c) => c.id));
  const delivered: Record<string, DeliveryChecklist | undefined> = Object.fromEntries(
    allDockets.filter((d) => d.type === 'DELIVERY' && d.status === 'COMPLETED').map((d) => [d.bookingId, d.checklist])
  );
  const byTime = (a: JobWithDetails[], b: JobWithDetails[], key: 'deliveryTime' | 'collectionTime') => (a[0][key] ?? '99').localeCompare(b[0][key] ?? '99');

  const open = (bookings: JobWithDetails[], type: JobType) => setJob({ bookings, type, delivered });

  const visitItems = (list: JobWithDetails[], date: (b: Booking) => string) =>
    groupVisits(list, date).map((g) => ({
      key: g[0].id,
      href: `/bookings/${bookingRef(g[0])}`,
      title: g[0].customer.name,
      subtitle: `${g.map((b) => b.unit.id).join(', ')} · ${g[0].deliveryAddress}`,
      meta: formatDate(date(g[0])),
    }));

  return (
    <div className="space-y-6">
      <KpiDrilldown
        cards={[
          { key: 'today', label: 'Deliveries today', icon: Truck, tone: 'scheduled', items: visitItems(todayDeliveries, byStart), emptyText: 'No deliveries today' },
          { key: 'tomorrow', label: 'Deliveries tomorrow', icon: CalendarClock, tone: 'neutral', items: visitItems(tomorrowDeliveries, byStart), emptyText: 'Nothing scheduled for tomorrow' },
          {
            key: 'due',
            label: 'Collections due',
            icon: PackageCheck,
            tone: collectionsDue.length ? 'danger' : 'neutral',
            emphasis: collectionsDue.length > 0,
            items: visitItems(collectionsDue, byEnd),
            emptyText: 'No collections due',
          },
          {
            key: 'hire',
            label: 'Units on hire',
            icon: Box,
            tone: 'info',
            items: activeHires.map((h) => ({
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

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BoardColumn
          title="Today"
          subtitle={formatDayDate(todayDate)}
          accent="bg-violet-500"
          visits={groupVisits(todayDeliveries, byStart).sort((a, b) => byTime(a, b, 'deliveryTime'))}
          type="delivery"
          onOpen={open}
          emptyText="No deliveries today"
        />
        <BoardColumn
          title="Tomorrow"
          subtitle={formatDayDate(tomorrowDate)}
          accent="bg-stone-400"
          visits={groupVisits(tomorrowDeliveries, byStart).sort((a, b) => byTime(a, b, 'deliveryTime'))}
          type="delivery"
          onOpen={open}
          emptyText="Nothing scheduled for tomorrow"
        />
        <BoardColumn
          title="Collections due"
          subtitle="Hire period ended"
          accent="bg-red-500"
          visits={groupVisits(collectionsDue, byEnd).sort((a, b) => a[0].endDate.localeCompare(b[0].endDate))}
          type="collection"
          delivered={delivered}
          onOpen={open}
          emptyText="No collections due"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Active hires */}
        <Panel title="On hire" count={activeHires.length} description="Units currently with customers" className="xl:col-span-3">
          {activeHires.length === 0 ? (
            <EmptyState compact icon={Box} title="No active hires" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Unit</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Return</th>
                    <th className="w-28 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...activeHires]
                    .sort((a, b) => a.endDate.localeCompare(b.endDate))
                    .map((h) => {
                      const d = daysFromToday(h.endDate);
                      return (
                        <tr key={h.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/bookings/${bookingRef(h)}`)}>
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2">
                              <UnitTypeIcon type={h.unit.unitType} />
                              <UnitCode id={h.unit.id} />
                            </span>
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-foreground">{h.customer.name}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {dueIds.has(h.id) ? (
                              <Pill tone="danger">{d < 0 ? `${-d}d overdue` : 'Due today'}</Pill>
                            ) : (
                              <span className="tabular text-muted-foreground">{formatDate(h.endDate)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                open(visitOf(h, activeHires, byEnd), 'collection');
                              }}
                            >
                              Collect
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4 xl:col-span-2">
          {comingUp.length > 0 && (
            <Panel title="Coming up" description="Deliveries scheduled after tomorrow" count={comingUp.length}>
              <ul className="divide-y">
                {comingUp.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => open([{ ...d.booking, customer: d.customer, unit: d.unit }], 'delivery')}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <Truck className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <UnitCode id={d.unit.id} />
                          <span className="truncate text-muted-foreground">{d.customer.name}</span>
                        </div>
                      </div>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {formatDate(d.scheduledDate)}
                        {d.scheduledTime && ` · ${d.scheduledTime}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Recently completed" count={completedDockets.length}>
            {completedDockets.length === 0 ? (
              <EmptyState compact icon={CircleCheck} title="No completed jobs yet" />
            ) : (
              <ul className="divide-y">
                {completedDockets.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md',
                        d.type === 'DELIVERY' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'
                      )}
                    >
                      {d.type === 'DELIVERY' ? <Truck className="size-3.5" /> : <PackageCheck className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <UnitCode id={d.unit.id} />
                        <span className="truncate text-muted-foreground">{d.customer.name}</span>
                      </div>
                      {d.signedBy && (
                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {d.signatureData && <PenLine className="size-3 shrink-0 text-emerald-600" aria-label="Signature captured" />}
                          Signed by {d.signedBy}
                        </div>
                      )}
                    </div>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {formatDate(d.completedAt ? d.completedAt.split('T')[0] : d.scheduledDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Job drawer */}
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

function BoardColumn({
  title,
  subtitle,
  accent,
  visits,
  type,
  delivered,
  onOpen,
  emptyText,
}: {
  title: string;
  subtitle: string;
  accent: string;
  visits: JobWithDetails[][];
  type: JobType;
  delivered?: Record<string, DeliveryChecklist | undefined>;
  onOpen: (jobs: JobWithDetails[], type: JobType) => void;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col rounded-[var(--radius-lg)] border bg-muted/40">
      <header className="flex items-center gap-2 px-4 py-3">
        <span className={cn('size-2 rounded-full', accent)} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="tabular rounded bg-white px-1.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">{visits.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
      </header>
      <div className="flex-1 space-y-2 px-2 pb-2">
        {visits.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-md border border-dashed bg-white/60 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          visits.map((v, i) => <JobCard key={v[0].id} visit={v} type={type} delivered={delivered} index={i + 1} onClick={() => onOpen(v, type)} />)
        )}
      </div>
    </section>
  );
}

function JobCard({
  visit,
  type,
  delivered,
  index,
  onClick,
}: {
  visit: JobWithDetails[];
  type: JobType;
  delivered?: Record<string, DeliveryChecklist | undefined>;
  index: number;
  onClick: () => void;
}) {
  const job = visit[0];
  const time = type === 'delivery' ? job.deliveryTime : job.collectionTime;
  const overdue = type === 'collection' ? -daysFromToday(job.endDate) : 0;
  const temps = [...new Set(visit.map((b) => `${b.tempRequired}°C`))].join(' / ');
  const items = visit.flatMap((b) => accessoryItems(b, type === 'collection' ? delivered?.[b.id] : undefined).map((i) => (visit.length > 1 ? `${b.unit.id}: ${i}` : i)));
  return (
    <button
      onClick={onClick}
      className="group block w-full rounded-md border bg-white p-3 text-left shadow-[var(--shadow-xs)] transition-shadow outline-none hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular flex size-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">{index}</span>
          {visit.map((b) => (
            <UnitCode key={b.id} id={b.unit.id} />
          ))}
        </div>
        <span className="tabular flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
          <Clock className="size-3 text-muted-foreground" />
          {time ?? 'Any time'}
        </span>
      </div>
      <div className="mt-2 truncate text-sm font-medium text-foreground">{job.customer.name}</div>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">{job.deliveryAddress}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {type === 'delivery' ? (
          <>
            <Tag icon={<Thermometer className="size-3" />}>{temps}</Tag>
            <Tag icon={<Zap className="size-3" />}>{powerShort(job)}</Tag>
          </>
        ) : overdue > 0 ? (
          <Pill tone="danger">{overdue}d overdue</Pill>
        ) : (
          <Pill tone="warning">Due today</Pill>
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 border-t pt-2 text-[11px] text-amber-800">
          <Package className="mt-px size-3 shrink-0" />
          <span>
            <span className="font-semibold">{type === 'delivery' ? 'Load: ' : 'Bring back: '}</span>
            {items.join(' · ')}
          </span>
        </div>
      )}
    </button>
  );
}

function Tag({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}
