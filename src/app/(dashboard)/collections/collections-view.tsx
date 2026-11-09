'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/ui/status-badge';
import { JobDrawer, accessoryItems, type JobTarget } from '@/components/jobs/job-drawer';
import { KpiDrilldown } from '@/components/app/kpi-drilldown';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import type { Booking, Customer, Unit, Staff, DeliveryDocket, DeliveryChecklist } from '@/types';
import { bookingRef, groupVisits } from '@/lib/jobs';
import { daysFromToday, formatDate, formatPhone, toISODate } from '@/lib/format';
import { CalendarClock, CircleCheck, Lock, MapPin, PackageCheck, Phone, ArrowUpRight, ExternalLink } from 'lucide-react';

type JobWithDetails = Booking & { customer: Customer; unit: Unit; deliveryDocket?: DeliveryDocket };
type DocketWithDetails = DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff; deliveryDocket?: DeliveryDocket };
type CompletedDocket = DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit };

interface CollectionsViewProps {
  collectionsDue: JobWithDetails[];
  staff: Staff[];
  upcomingCollections: DocketWithDetails[];
  completedCollections: CompletedDocket[];
  collectionsFromBookings: JobWithDetails[];
}

const byEnd = (b: Booking) => b.endDate;

export function CollectionsView({ staff, upcomingCollections, completedCollections, collectionsFromBookings }: CollectionsViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const [tomorrow] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  });
  const dueIds = new Set(collectionsFromBookings.map((b) => b.id));
  const scheduled: JobWithDetails[] = upcomingCollections
    .filter((d) => d.booking.status === 'ON_HIRE' && !dueIds.has(d.bookingId))
    .map((d) => ({ ...d.booking, customer: d.customer, unit: d.unit, deliveryDocket: d.deliveryDocket, endDate: d.scheduledDate, collectionTime: d.scheduledTime }));
  const delivered: Record<string, DeliveryChecklist | undefined> = Object.fromEntries(
    [...collectionsFromBookings, ...scheduled].map((b) => [b.id, b.deliveryDocket?.checklist])
  );
  const recover = (b: JobWithDetails) => accessoryItems(b, b.deliveryDocket?.checklist);
  const collect = (bookings: JobWithDetails[]) => setJob({ bookings, type: 'collection', delivered });

  const dueVisits = groupVisits(collectionsFromBookings, byEnd);
  const scheduledVisits = groupVisits(scheduled, byEnd);
  const tomorrowVisits = scheduledVisits.filter((v) => v[0].endDate === tomorrow);
  const overdue = collectionsFromBookings.filter((b) => daysFromToday(b.endDate) < 0).length;
  const toItems = (visits: JobWithDetails[][]) =>
    visits.map((v) => ({
      key: v[0].id,
      href: `/bookings/${bookingRef(v[0])}`,
      title: v[0].customer.name,
      subtitle: `${v.map((b) => b.unit.id).join(', ')} · ${v[0].deliveryAddress}`,
      meta: formatDate(v[0].endDate),
    }));

  return (
    <div className="space-y-6">
      <KpiDrilldown
        cards={[
          {
            key: 'due',
            label: 'Due for collection',
            icon: PackageCheck,
            tone: overdue ? 'danger' : 'warning',
            emphasis: overdue > 0,
            hint: overdue ? `${overdue} overdue` : undefined,
            items: toItems(dueVisits),
            emptyText: 'Nothing due for collection',
          },
          { key: 'tomorrow', label: 'Collections tomorrow', icon: CalendarClock, tone: 'scheduled', items: toItems(tomorrowVisits), emptyText: 'No collections tomorrow' },
          {
            key: 'recover',
            label: 'Accessories to recover',
            icon: Lock,
            tone: 'warning',
            items: [...collectionsFromBookings, ...scheduled]
              .filter((b) => recover(b).length > 0)
              .map((b) => ({
                key: b.id,
                href: `/bookings/${bookingRef(b)}`,
                title: (
                  <span className="flex items-center gap-2">
                    <UnitCode id={b.unit.id} /> {b.customer.name}
                  </span>
                ),
                subtitle: recover(b).join(' · '),
                meta: formatDate(b.endDate),
              })),
            emptyText: 'No locks, clamps, cables or recorders on site',
          },
          {
            key: 'done',
            label: 'Completed',
            icon: CircleCheck,
            tone: 'success',
            hint: 'All time',
            items: completedCollections.map((d) => ({
              key: d.id,
              href: `/bookings/${bookingRef(d.booking)}`,
              title: (
                <span className="flex items-center gap-2">
                  <UnitCode id={d.unit.id} /> {d.customer.name}
                </span>
              ),
              subtitle: d.signedBy ? `Signed by ${d.signedBy}` : undefined,
              meta: formatDate(d.completedAt ? d.completedAt.split('T')[0] : d.scheduledDate),
            })),
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Due for collection" count={collectionsFromBookings.length} description="Hire period has ended" className="xl:col-span-2">
          {dueVisits.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Nothing to collect" description="Units due back will appear here once their hire period ends." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Units</th>
                    <th className="px-4 py-2.5 font-medium">Customer &amp; site</th>
                    <th className="px-4 py-2.5 font-medium">Due</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">To bring back</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dueVisits.map((v) => {
                    const b = v[0];
                    const d = daysFromToday(b.endDate);
                    return (
                      <tr key={b.id} className="group cursor-pointer align-top hover:bg-muted/40" onClick={() => router.push(`/bookings/${bookingRef(b)}`)}>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {v.map((l) => (
                              <span key={l.id} className="flex items-center gap-2">
                                <UnitTypeIcon type={l.unit.unitType} />
                                <UnitCode id={l.unit.id} />
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-[300px] px-4 py-3">
                          <div className="truncate font-medium text-foreground">{b.customer.name}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{b.deliveryAddress}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Pill tone={d < 0 ? 'danger' : 'warning'}>{d < 0 ? `${-d}d overdue` : 'Today'}</Pill>
                          <div className="tabular mt-1 text-xs text-muted-foreground">{formatDate(b.endDate)}</div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <RecoverList visit={v} recover={recover} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <a
                            href={`tel:${b.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            title={formatPhone(b.contactPhone)}
                            aria-label={`Call ${b.contactName}`}
                            className="mr-1.5 inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-muted"
                          >
                            <Phone className="size-3.5" />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              collect(v);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <PackageCheck className="size-3.5" /> Collect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Scheduled collections" description="Units on hire, by return date" count={scheduled.length}>
          {scheduledVisits.length === 0 ? (
            <EmptyState compact icon={CalendarClock} title="No collections scheduled" />
          ) : (
            <ul className="divide-y">
              {scheduledVisits.slice(0, 10).map((v) => {
                const b = v[0];
                const items = v.flatMap((l) => recover(l).map((i) => (v.length > 1 ? `${l.unit.id}: ${i}` : i)));
                return (
                  <li key={b.id}>
                    <button onClick={() => collect(v)} className="w-full px-4 py-3 text-left hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {v.map((l) => (
                            <UnitCode key={l.id} id={l.unit.id} />
                          ))}
                          <span className="truncate text-sm text-muted-foreground">{b.customer.name}</span>
                        </div>
                        <span className="tabular shrink-0 text-xs font-medium text-foreground">
                          {formatDate(b.endDate)}
                          {b.collectionTime && <span className="text-muted-foreground"> · {b.collectionTime}</span>}
                        </span>
                      </div>
                      {items.length > 0 && <div className="mt-1 text-xs text-amber-700">Bring back: {items.join(', ')}</div>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Collection history" count={completedCollections.length} description="Completed collections, most recent first">
        {completedCollections.length === 0 ? (
          <EmptyState compact icon={CircleCheck} title="No completed collections yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Completed</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Signed by</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Location</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {completedCollections.slice(0, 15).map((d) => (
                  <tr key={d.id} className="group hover:bg-muted/40">
                    <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(d.completedAt ? d.completedAt.split('T')[0] : d.scheduledDate, { year: true })}
                    </td>
                    <td className="px-4 py-3">
                      <UnitCode id={d.unit.id} />
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-foreground">{d.customer.name}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{d.signedBy || '—'}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {d.what3wordsAddress ? (
                        <a
                          href={`https://what3words.com/${d.what3wordsAddress.replace(/^\/+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                        >
                          {d.what3wordsAddress} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="pr-4">
                      <Link href={`/bookings/${bookingRef(d.booking)}`} aria-label="Open booking" className="text-muted-foreground/50 group-hover:text-foreground">
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

function RecoverList({ visit, recover }: { visit: JobWithDetails[]; recover: (b: JobWithDetails) => string[] }) {
  const rows = visit.map((b) => ({ b, items: recover(b) })).filter((r) => r.items.length);
  if (rows.length === 0) return <span className="text-xs text-muted-foreground">Unit only</span>;
  return (
    <div className="space-y-1">
      {rows.map(({ b, items }) => (
        <div key={b.id} className="flex flex-wrap items-center gap-1">
          {visit.length > 1 && <span className="font-mono-unit mr-0.5 text-[11px] text-muted-foreground">{b.unit.id}</span>}
          {items.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
              <Lock className="size-3" /> {r}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
