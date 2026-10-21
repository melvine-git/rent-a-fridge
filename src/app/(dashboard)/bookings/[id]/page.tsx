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
import { daysBetween, daysFromToday, formatDate, formatDayDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Check, Minus, Navigation, Phone, ArrowUpRight, CircleAlert } from 'lucide-react';

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
  const { booking, delivery, collection, staff } = data;
  const { customer, unit } = booking;

  const days = daysBetween(booking.startDate, booking.endDate);
  const untilEnd = daysFromToday(booking.endDate);
  const untilStart = daysFromToday(booking.startDate);
  const actionOverdue = booking.actionDate && booking.status !== 'COLLECTED' && daysFromToday(booking.actionDate) <= 0;

  const steps: TimelineStep[] = [
    { label: 'Booked', detail: formatDate(booking.createdAt, { year: true }), state: 'done' },
    {
      label: 'Delivered',
      detail: delivery?.completedAt
        ? `${formatDate(delivery.completedAt.split('T')[0])} · ${staff[delivery.staffId] ?? ''}${delivery.signedBy ? ` · signed by ${delivery.signedBy}` : ''}`
        : `Scheduled ${formatDayDate(booking.startDate)}${booking.deliveryTime ? ` at ${booking.deliveryTime}` : ''}`,
      state: booking.status === 'CONFIRMED' ? 'current' : 'done',
    },
    {
      label: 'Collected',
      detail: collection?.completedAt
        ? `${formatDate(collection.completedAt.split('T')[0])}${collection.signedBy ? ` · signed by ${collection.signedBy}` : ''}`
        : `Due ${formatDayDate(booking.endDate)}${booking.collectionTime ? ` at ${booking.collectionTime}` : ''}`,
      state: booking.status === 'COLLECTED' ? 'done' : booking.status === 'ON_HIRE' ? 'current' : 'upcoming',
    },
  ];

  const timing =
    booking.status === 'CONFIRMED'
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
        actions={<BookingActions email={customer.email} phone={booking.contactPhone} />}
      />

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
                  href={`https://maps.google.com/?q=${encodeURIComponent(booking.deliveryAddress)}`}
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
              <DetailItem label="Delivery address" full>
                {booking.deliveryAddress}
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
