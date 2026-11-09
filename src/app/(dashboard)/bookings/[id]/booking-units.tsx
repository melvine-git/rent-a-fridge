'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Panel } from '@/components/app/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { JobDrawer, accessoryItems, type JobTarget } from '@/components/jobs/job-drawer';
import { UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, formatDayDate } from '@/lib/format';
import { Package, PackageCheck, Truck } from 'lucide-react';
import type { BookingWithDetails, DeliveryDocket, Staff } from '@/types';

export type LineDetail = BookingWithDetails & { delivery?: DeliveryDocket; collection?: DeliveryDocket };

/** Delivery checklists of completed deliveries, by booking line id. */
export const deliveredChecklists = (lines: LineDetail[]) =>
  Object.fromEntries(lines.map((l) => [l.id, l.delivery?.status === 'COMPLETED' ? l.delivery.checklist : undefined]));

export function BookingUnits({ lines, staff }: { lines: LineDetail[]; staff: Staff[] }) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const delivered = deliveredChecklists(lines);

  return (
    <Panel title={lines.length > 1 ? 'Units on this booking' : 'Unit'} count={lines.length > 1 ? lines.length : undefined}>
      <ul className="divide-y">
        {lines.map((l) => {
          const items = accessoryItems(l, l.status === 'CONFIRMED' ? undefined : delivered[l.id]);
          return (
            <li key={l.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <Link href={`/units/${l.unit.id}`} className="flex min-w-0 items-center gap-3 sm:w-48">
                <UnitTypeIcon type={l.unit.unitType} boxed />
                <div className="min-w-0">
                  <div className="font-mono-unit text-sm text-foreground hover:underline">{l.unit.id}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {UNIT_TYPE_LABELS[l.unit.unitType]} · {l.tempRequired}°C
                  </div>
                </div>
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <div className="tabular text-foreground">
                  {formatDayDate(l.startDate)}
                  {l.deliveryTime && <span className="text-muted-foreground"> {l.deliveryTime}</span>}
                  <span className="text-muted-foreground"> → </span>
                  {formatDayDate(l.endDate)}
                  {l.collectionTime && <span className="text-muted-foreground"> {l.collectionTime}</span>}
                  <span className="ml-1.5 text-xs text-muted-foreground">({daysBetween(l.startDate, l.endDate)} days)</span>
                </div>
                {items.length > 0 && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="size-3 shrink-0" />
                    <span className="truncate">
                      {l.status === 'CONFIRMED' ? 'To deliver: ' : l.status === 'ON_HIRE' ? 'On site: ' : ''}
                      {items.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={l.status} />
                {l.status === 'CONFIRMED' && (
                  <button
                    onClick={() => setJob({ bookings: [l], type: 'delivery', delivered })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    <Truck className="size-3.5" /> Deliver
                  </button>
                )}
                {l.status === 'ON_HIRE' && (
                  <button
                    onClick={() => setJob({ bookings: [l], type: 'collection', delivered })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    <PackageCheck className="size-3.5" /> Collect
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <JobDrawer
        job={job}
        staff={staff}
        onClose={() => setJob(null)}
        onCompleted={() => {
          setJob(null);
          router.refresh();
        }}
      />
    </Panel>
  );
}
