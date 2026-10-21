import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBookingDetail } from '@/lib/actions';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { DetailItem, DetailList, StatStrip, Timeline, type TimelineStep } from '@/components/app/detail';
import { Avatar } from '@/components/app/avatar';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { StatusBadge, Pill } from '@/components/ui/status-badge';
import { BookingActions } from './booking-actions';
import { POWER_LABELS, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, daysFromToday, formatDate, formatDayDate, formatPhone, w3wUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Ban, Check, Minus, Navigation, Phone, ArrowUpRight, CircleAlert, ExternalLink } from 'lucide-react';
import type { DeliveryDocket } from '@/types';

export const dynamic = 'force-dynamic';

const ACCESSORIES = [
  { key: 'hitchLock', label: 'Hitch lock' },
  { key: 'wheelClamp', label: 'Wheel clamp' },
  { key: 'doorLock', label: 'Door lock' },
  { key: 'tempRecorder', label: 'Temperature recorder' },
] as const;

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBookingDetail(id);
  if (!data) notFound();
  const { booking, delivery, collection, staff, allStaff, units } = data;
  const { customer, unit } = booking;

  const days = daysBetween(booking.startDate, booking.endDate);
  const untilEnd = daysFromToday(booking.endDate);
  const untilStart = daysFromToday(booking.startDate);
  const isActive = booking.status === 'CONFIRMED' || booking.status === 'ON_HIRE';
  const actionOverdue = booking.actionDate && isActive && daysFromToday(booking.actionDate) <= 0;
  const cancelled = booking.status === 'CANCELLED';
  const deliveryDone = delivery?.status === 'COMPLETED' ? delivery : undefined;
  const collectionDone = collection?.status === 'COMPLETED' ? collection : undefined;

  const steps: TimelineStep[] = cancelled
    ? [
        { label: 'Booked', detail: formatDate(booking.createdAt, { year: true }), state: 'done' },
        { label: 'Cancelled', detail: booking.cancelledAt ? formatDate(booking.cancelledAt.split('T')[0], { year: true }) : undefined, state: 'current' },
      ]
    : [
        { label: 'Booked', detail: formatDate(booking.createdAt, { year: true }), state: 'done' },
        {
          label: 'Delivered',
          detail: deliveryDone?.completedAt
            ? `${formatDate(deliveryDone.completedAt.split('T')[0])} · ${staff[deliveryDone.staffId] ?? ''}${deliveryDone.signedBy ? ` · signed by ${deliveryDone.signedBy}` : ''}`
            : `Scheduled ${formatDayDate(booking.startDate)}${booking.deliveryTime ? ` at ${booking.deliveryTime}` : ''}`,
          state: booking.status === 'CONFIRMED' ? 'current' : 'done',
        },
        {
          label: 'Collected',
          detail: collectionDone?.completedAt
            ? `${formatDate(collectionDone.completedAt.split('T')[0])}${collectionDone.signedBy ? ` · signed by ${collectionDone.signedBy}` : ''}`
            : `Due ${formatDayDate(booking.endDate)}${booking.collectionTime ? ` at ${booking.collectionTime}` : ''}`,
          state: booking.status === 'COLLECTED' ? 'done' : booking.status === 'ON_HIRE' ? 'current' : 'upcoming',
        },
      ];

  const timing = cancelled
    ? `Cancelled${booking.cancelledAt ? ` on ${formatDate(booking.cancelledAt.split('T')[0], { year: true })}` : ''}`
    : booking.status === 'CONFIRMED'
      ? untilStart > 0
        ? `Delivery in ${untilStart} day${untilStart > 1 ? 's' : ''}`
        : untilStart === 0
          ? 'Delivery today'
          : 'Delivery overdue'
      : booking.status === 'ON_HIRE'
        ? untilEnd > 0
          ? `${untilEnd} day${untilEnd > 1 ? 's' : ''} remaining`
          : untilEnd === 0
            ? 'Collection due today'
            : `Collection ${-untilEnd}d overdue`
        : 'Hire complete';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Bookings', href: '/bookings' }, { label: booking.id }]}
        title={customer.name}
        meta={
          <>
            <StatusBadge status={booking.status} />
            <span className="font-mono-unit text-xs text-muted-foreground">{booking.id}</span>
          </>
        }
        description={timing}
        actions={<BookingActions booking={booking} staff={allStaff} units={units} deliveredChecklist={deliveryDone?.checklist} />}
      />

      {cancelled && (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-red-200 bg-red-50/70 px-4 py-3">
          <Ban className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm">
            <span className="font-semibold text-red-900">This booking was cancelled</span>
            {booking.cancellationReason && <span className="text-red-800/80"> · {booking.cancellationReason}</span>}
          </div>
        </div>
      )}

      {actionOverdue && (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-red-200 bg-red-50/70 px-4 py-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm">
            <span className="font-semibold text-red-900">{booking.actionDescription || 'Follow-up required'}</span>
            <span className="text-red-800/80"> · action was due {formatDate(booking.actionDate)}</span>
          </div>
        </div>
      )}

      <StatStrip
        items={[
          { label: 'Hire period', value: `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`, sub: `${days} days` },
          { label: 'Unit', value: <span className="font-mono-unit">{unit.id}</span>, sub: UNIT_TYPE_LABELS[unit.unitType] },
          { label: 'Temperature', value: `${booking.tempRequired}°C`, sub: booking.application || 'Application not specified' },
          { label: 'Power', value: booking.powerAvailable === 'INDUSTRIAL' ? '32A industrial' : '13A standard', sub: booking.cableLength ? `${booking.cableLength} cable` : 'No cable specified' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Panel
            title="Site & contact"
            action={
              <>
                <a href={`tel:${booking.contactPhone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                  <Phone className="size-3.5" /> Call
                </a>
                <a
                  href={booking.what3wordsAddress ? w3wUrl(booking.what3wordsAddress) : `https://maps.google.com/?q=${encodeURIComponent(booking.deliveryAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                >
                  <Navigation className="size-3.5" /> Map
                </a>
              </>
            }
          >
            <DetailList cols={2}>
              <DetailItem label="Delivery address">{booking.deliveryAddress}</DetailItem>
              <DetailItem label="what3words">
                {booking.what3wordsAddress ? (
                  <a href={w3wUrl(booking.what3wordsAddress)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--brand-red)] hover:underline">
                    {booking.what3wordsAddress} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </DetailItem>
              <DetailItem label="Site contact">{booking.contactName}</DetailItem>
              <DetailItem label="Contact phone">
                <a href={`tel:${booking.contactPhone}`} className="tabular hover:underline">
                  {formatPhone(booking.contactPhone)}
                </a>
              </DetailItem>
              <DetailItem label="Delivery">
                {formatDayDate(booking.startDate)}
                {booking.deliveryTime && <span className="text-muted-foreground"> · {booking.deliveryTime}</span>}
              </DetailItem>
              <DetailItem label="Collection">
                {formatDayDate(booking.endDate)}
                {booking.collectionTime && <span className="text-muted-foreground"> · {booking.collectionTime}</span>}
              </DetailItem>
              {booking.accessInstructions && (
                <DetailItem label="Access instructions" full>
                  <span className="block rounded-md bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-600/15 ring-inset">{booking.accessInstructions}</span>
                </DetailItem>
              )}
            </DetailList>
          </Panel>

          <Panel title="Requirements">
            <DetailList cols={2}>
              <DetailItem label="Temperature">{booking.tempRequired}°C</DetailItem>
              <DetailItem label="Power available">{POWER_LABELS[booking.powerAvailable]}</DetailItem>
              <DetailItem label="Cable length">{booking.cableLength}</DetailItem>
              <DetailItem label="Application">{booking.application}</DetailItem>
            </DetailList>
            <div className="border-t p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Accessories</div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {ACCESSORIES.map(({ key, label }) => {
                  const on = !!booking.accessories?.[key];
                  return (
                    <li key={key} className={cn('flex items-center gap-2 text-sm', on ? 'text-foreground' : 'text-muted-foreground')}>
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded',
                          on ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/20' : 'bg-muted text-muted-foreground/60'
                        )}
                      >
                        {on ? <Check className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" />}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>

          {(deliveryDone || collectionDone) && (
            <Panel title="Proof of delivery & collection" description="Signed records captured on site">
              <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <JobRecord title="Delivery" docket={deliveryDone} driver={deliveryDone && staff[deliveryDone.staffId]} />
                <JobRecord title="Collection" docket={collectionDone} driver={collectionDone && staff[collectionDone.staffId]} />
              </div>
            </Panel>
          )}

          {booking.notes && (
            <Panel title="Notes">
              <p className="p-4 text-sm whitespace-pre-line text-foreground">{booking.notes}</p>
            </Panel>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Panel title="Progress">
            <Timeline steps={steps} />
            {(booking.emailSent || booking.smsSent) && (
              <div className="flex gap-2 border-t px-4 py-3">
                {booking.emailSent && <Pill tone="success">Email sent</Pill>}
                {booking.smsSent && <Pill tone="success">SMS sent</Pill>}
              </div>
            )}
          </Panel>

          <Panel
            title="Unit"
            action={
              <Link href={`/units/${unit.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                View <ArrowUpRight className="size-3.5" />
              </Link>
            }
          >
            <div className="flex items-center gap-3 p-4">
              <UnitTypeIcon type={unit.unitType} boxed className="size-10" />
              <div>
                <div className="font-mono-unit text-base text-foreground">{unit.id}</div>
                <div className="text-xs text-muted-foreground">
                  {UNIT_TYPE_LABELS[unit.unitType]} · {UNIT_SIZE_LABELS[unit.size]} · {unit.powerType === 'INDUSTRIAL' ? '32A' : '13A'}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Customer"
            action={
              <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                View <ArrowUpRight className="size-3.5" />
              </Link>
            }
          >
            <div className="flex items-center gap-3 border-b p-4">
              <Avatar name={customer.name} />
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{customer.name}</div>
                <div className="text-xs text-muted-foreground">Customer since {formatDate(customer.createdAt, { year: true })}</div>
              </div>
            </div>
            <DetailList>
              <DetailItem label="Phone">
                <a href={`tel:${customer.phone}`} className="tabular hover:underline">
                  {formatPhone(customer.phone)}
                </a>
              </DetailItem>
              {customer.email && (
                <DetailItem label="Email">
                  <a href={`mailto:${customer.email}`} className="break-all hover:underline">
                    {customer.email}
                  </a>
                </DetailItem>
              )}
              <DetailItem label="Invoice address">{customer.address}</DetailItem>
            </DetailList>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function JobRecord({ title, docket, driver }: { title: string; docket?: DeliveryDocket; driver?: string }) {
  if (!docket) {
    return (
      <div className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <p className="mt-2 text-sm text-muted-foreground">Not yet completed</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Pill tone="success">Completed</Pill>
      </div>
      {docket.signatureData ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL captured on site, not an optimisable asset
        <img src={docket.signatureData} alt={`Signature of ${docket.signedBy}`} className="h-20 w-full rounded-md border bg-white object-contain" />
      ) : (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">No drawn signature on file</div>
      )}
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Signed by</dt>
          <dd className="text-right font-medium text-foreground">{docket.signedBy || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">When</dt>
          <dd className="tabular text-right text-foreground">
            {docket.completedAt
              ? new Date(docket.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </dd>
        </div>
        {driver && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Driver</dt>
            <dd className="text-right text-foreground">{driver}</dd>
          </div>
        )}
        {docket.what3wordsAddress && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-right">
              <a href={w3wUrl(docket.what3wordsAddress)} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--brand-red)] hover:underline">
                {docket.what3wordsAddress}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {docket.damageNotes && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-600/15 ring-inset">
          <span className="font-semibold">Damage reported:</span> {docket.damageNotes}
        </p>
      )}
    </div>
  );
}
