'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/ui/status-badge';
import { JobDrawer, type JobTarget } from '@/components/jobs/job-drawer';
import { KpiCard } from '@/components/app/kpi-card';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import type { Booking, Customer, Unit, Staff, DeliveryDocket } from '@/types';
import { daysFromToday, formatDate, formatPhone } from '@/lib/format';
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

function itemsToRecover(checklist?: DeliveryDocket['checklist']): string[] {
  if (!checklist) return [];
  return [
    checklist.hitchLockSecured && 'Hitch lock',
    checklist.wheelClampSecured && 'Wheel clamp',
    checklist.doorLockSecured && 'Door lock',
    checklist.cableLengthUsed && `Cable ${checklist.cableLengthUsed}`,
  ].filter((x): x is string => !!x);
}

export function CollectionsView({ collectionsDue, staff, upcomingCollections, completedCollections, collectionsFromBookings }: CollectionsViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const collect = (booking: Booking & { customer: Customer; unit: Unit }, delivery?: DeliveryDocket) =>
    setJob({ booking, type: 'collection', deliveredChecklist: delivery?.checklist });
  const dueIds = new Set(collectionsFromBookings.map((b) => b.id));
  const scheduled = upcomingCollections.filter((d) => d.booking.status === 'ON_HIRE' && !dueIds.has(d.bookingId));

  const withAccessories = collectionsFromBookings.filter((b) => itemsToRecover(b.deliveryDocket?.checklist).length > 0).length;
  const overdue = collectionsFromBookings.filter((b) => daysFromToday(b.endDate) < 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Due for collection"
          value={collectionsDue.length}
          icon={PackageCheck}
          tone={overdue ? 'danger' : 'warning'}
          emphasis={overdue > 0}
          hint={overdue ? `${overdue} overdue` : 'None overdue'}
        />
        <KpiCard label="Scheduled" value={scheduled.length} icon={CalendarClock} tone="scheduled" hint="Collection dockets booked" />
        <KpiCard label="Accessories to recover" value={withAccessories} icon={Lock} tone="warning" hint="Locks, clamps and cables on site" />
        <KpiCard label="Completed" value={completedCollections.length} icon={CircleCheck} tone="success" hint="All time" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Due for collection" count={collectionsFromBookings.length} description="Hire period has ended" className="xl:col-span-2">
          {collectionsFromBookings.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Nothing to collect" description="Units due back will appear here once their hire period ends." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Unit</th>
                    <th className="px-4 py-2.5 font-medium">Customer &amp; site</th>
                    <th className="px-4 py-2.5 font-medium">Due</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">To recover</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {collectionsFromBookings.map((b) => {
                    const d = daysFromToday(b.endDate);
                    const recover = itemsToRecover(b.deliveryDocket?.checklist);
                    return (
                      <tr key={b.id} className="group cursor-pointer align-top hover:bg-muted/40" onClick={() => router.push(`/bookings/${b.id}`)}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <UnitTypeIcon type={b.unit.unitType} />
                            <UnitCode id={b.unit.id} />
                          </span>
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
                          {recover.length ? (
                            <div className="flex flex-wrap gap-1">
                              {recover.map((r) => (
                                <span key={r} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
                                  <Lock className="size-3" /> {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unit only</span>
                          )}
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
                              collect(b, b.deliveryDocket);
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
          {scheduled.length === 0 ? (
            <EmptyState compact icon={CalendarClock} title="No collections scheduled" />
          ) : (
            <ul className="divide-y">
              {scheduled.slice(0, 8).map((d) => {
                const recover = itemsToRecover(d.deliveryDocket?.checklist);
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => collect({ ...d.booking, customer: d.customer, unit: d.unit }, d.deliveryDocket)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <UnitCode id={d.unit.id} />
                          <span className="truncate text-sm text-muted-foreground">{d.customer.name}</span>
                        </div>
                        <span className="tabular shrink-0 text-xs font-medium text-foreground">
                          {formatDate(d.scheduledDate)}
                          {d.scheduledTime && <span className="text-muted-foreground"> · {d.scheduledTime}</span>}
                        </span>
                      </div>
                      {recover.length > 0 && <div className="mt-1 truncate text-xs text-amber-700">Recover: {recover.join(', ')}</div>}
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
                      <Link href={`/bookings/${d.bookingId}`} aria-label="Open booking" className="text-muted-foreground/50 group-hover:text-foreground">
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
