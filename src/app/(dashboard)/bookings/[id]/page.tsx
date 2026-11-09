import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBookingDetail } from '@/lib/actions';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { DetailItem, DetailList, StatStrip, Timeline, type TimelineStep } from '@/components/app/detail';
import { Avatar } from '@/components/app/avatar';
import { StatusBadge, Pill } from '@/components/ui/status-badge';
import { QuoteTotals } from '@/components/bookings/booking-editors';
import { BookingActions } from './booking-actions';
import { BookingUnits } from './booking-units';
import { GBP, lineCharge, powerLabel, quoteTotals } from '@/lib/domain';
import { daysFromToday, formatDate, formatPhone, w3wUrl } from '@/lib/format';
import { Ban, Navigation, Phone, ArrowUpRight, CircleAlert, ExternalLink } from 'lucide-react';
import type { BookingStatus, DeliveryDocket } from '@/types';

export const dynamic = 'force-dynamic';

/** One status for the whole booking, from its unit lines. */
function groupStatus(statuses: BookingStatus[]): BookingStatus {
  if (statuses.some((s) => s === 'ON_HIRE')) return 'ON_HIRE';
  if (statuses.some((s) => s === 'CONFIRMED')) return 'CONFIRMED';
  if (statuses.every((s) => s === 'CANCELLED')) return 'CANCELLED';
  return 'COLLECTED';
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBookingDetail(id);
  if (!data) notFound();
  const { booking, lines, reference, staff, allStaff, units } = data;
  const { customer } = booking;

  const live = lines.filter((l) => l.status !== 'CANCELLED');
  const status = groupStatus(lines.map((l) => l.status));
  const cancelled = status === 'CANCELLED';
  const isActive = status === 'CONFIRMED' || status === 'ON_HIRE';
  const dates = (live.length ? live : lines).flatMap((l) => [l.startDate, l.endDate]).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1)!;
  const actionOverdue = booking.actionDate && isActive && daysFromToday(booking.actionDate) <= 0;
  const delivered = live.filter((l) => l.status === 'ON_HIRE' || l.status === 'COLLECTED').length;
  const collected = live.filter((l) => l.status === 'COLLECTED').length;
  const totals = quoteTotals(lines, booking.quote);
  const priced = live.some((l) => l.rate !== undefined) || (booking.quote?.extras.length ?? 0) > 0;

  const nextDelivery = live.filter((l) => l.status === 'CONFIRMED').map((l) => l.startDate).sort()[0];
  const nextCollection = live.filter((l) => l.status === 'ON_HIRE').map((l) => l.endDate).sort()[0];
  const until = (d: string) => daysFromToday(d);
  const timing = cancelled
    ? `Cancelled${booking.cancelledAt ? ` on ${formatDate(booking.cancelledAt.split('T')[0], { year: true })}` : ''}`
    : nextDelivery
      ? until(nextDelivery) > 0
        ? `Delivery in ${until(nextDelivery)} day${until(nextDelivery) > 1 ? 's' : ''}`
        : until(nextDelivery) === 0
          ? 'Delivery today'
          : 'Delivery overdue'
      : nextCollection
        ? until(nextCollection) > 0
          ? `${until(nextCollection)} day${until(nextCollection) > 1 ? 's' : ''} until collection`
          : until(nextCollection) === 0
            ? 'Collection due today'
            : `Collection ${-until(nextCollection)}d overdue`
        : 'Hire complete';

  const steps: TimelineStep[] = cancelled
    ? [
        { label: 'Booked', detail: formatDate(booking.createdAt, { year: true }), state: 'done' },
        { label: 'Cancelled', detail: booking.cancellationReason, state: 'current' },
      ]
    : [
        { label: 'Booked', detail: formatDate(booking.createdAt, { year: true }), state: 'done' },
        {
          label: 'Delivered',
          detail: live.length > 1 ? `${delivered} of ${live.length} units` : delivered ? 'Unit delivered' : `Scheduled ${formatDate(firstDate)}`,
          state: delivered === live.length ? 'done' : delivered > 0 || status === 'CONFIRMED' ? 'current' : 'upcoming',
        },
        {
          label: 'Collected',
          detail: live.length > 1 ? `${collected} of ${live.length} units` : collected ? 'Unit collected' : `Due ${formatDate(lastDate)}`,
          state: collected === live.length ? 'done' : delivered > 0 ? 'current' : 'upcoming',
        },
      ];

  const proofs = lines
    .flatMap((l) => [l.delivery, l.collection].filter((d): d is DeliveryDocket => d?.status === 'COMPLETED').map((d) => ({ line: l, docket: d })))
    .sort((a, b) => (a.docket.completedAt ?? '').localeCompare(b.docket.completedAt ?? ''));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Bookings', href: '/bookings' }, { label: reference }]}
        title={customer.name}
        meta={
          <>
            <StatusBadge status={status} />
            <span className="font-mono-unit text-xs text-muted-foreground">{reference}</span>
          </>
        }
        description={timing}
        actions={<BookingActions reference={reference} lines={lines} staff={allStaff} units={units} />}
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
          { label: 'Hire period', value: `${formatDate(firstDate)} – ${formatDate(lastDate)}`, sub: live.length > 1 ? 'Across all units' : undefined },
          { label: live.length === 1 ? 'Unit' : 'Units', value: live.length, sub: <span className="font-mono-unit">{live.map((l) => l.unit.id).join(', ') || '—'}</span> },
          { label: 'Site power', value: powerLabel(booking), sub: booking.application || 'Application not specified' },
          { label: 'Quoted total', value: priced ? GBP.format(totals.total) : 'Not priced', sub: priced ? `inc. VAT · ${GBP.format(totals.net)} net` : 'Add rates under Edit' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <BookingUnits lines={lines} staff={allStaff} />

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
              <DetailItem label="Site contact phone">
                <a href={`tel:${booking.contactPhone}`} className="tabular hover:underline">
                  {formatPhone(booking.contactPhone)}
                </a>
              </DetailItem>
              <DetailItem label="Site power">{powerLabel(booking)}</DetailItem>
              <DetailItem label="Application">{booking.application || <span className="text-muted-foreground">Not specified</span>}</DetailItem>
              {booking.accessInstructions && (
                <DetailItem label="Access instructions" full>
                  <span className="block rounded-md bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-600/15 ring-inset">{booking.accessInstructions}</span>
                </DetailItem>
              )}
            </DetailList>
          </Panel>

          <Panel title="Quote" description={booking.quote?.poNumber ? `Customer PO ${booking.quote.poNumber}` : 'Prices ex VAT'}>
            {priced ? (
              <div className="space-y-4 p-4">
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Price</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {live.map((l) => {
                        const c = lineCharge(l);
                        return (
                          <tr key={l.id}>
                            <td className="px-3 py-2 text-foreground">
                              Hire of <span className="font-mono-unit">{l.unit.id}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatDate(l.startDate)} – {formatDate(l.endDate)}
                              </span>
                            </td>
                            <td className="tabular px-3 py-2 text-right text-muted-foreground">
                              {c.qty} {c.unit}
                            </td>
                            <td className="tabular px-3 py-2 text-right text-muted-foreground">{l.rate !== undefined ? GBP.format(l.rate) : '—'}</td>
                            <td className="tabular px-3 py-2 text-right text-foreground">{GBP.format(c.amount)}</td>
                          </tr>
                        );
                      })}
                      {booking.quote?.extras.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2 text-foreground">{e.description}</td>
                          <td className="tabular px-3 py-2 text-right text-muted-foreground">{e.quantity}</td>
                          <td className="tabular px-3 py-2 text-right text-muted-foreground">{GBP.format(e.unitPrice)}</td>
                          <td className="tabular px-3 py-2 text-right text-foreground">{GBP.format(e.quantity * e.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-xs text-muted-foreground sm:max-w-xs">
                    {customer.xeroContactId ? 'Ready to raise as an invoice in Xero for this customer.' : 'Link this customer to Xero (customer page) before raising the invoice.'}
                  </p>
                  <div className="sm:w-64">
                    <QuoteTotals totals={totals} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No prices yet. Use Edit to add a rate for each unit and any extra charges.</p>
            )}
          </Panel>

          {proofs.length > 0 && (
            <Panel title="Proof of delivery & collection" description="Signed records captured on site">
              <div className="grid gap-px bg-border sm:grid-cols-2">
                {proofs.map(({ line, docket }) => (
                  <JobRecord key={docket.id} title={`${docket.type === 'DELIVERY' ? 'Delivery' : 'Collection'} · ${line.unit.id}`} docket={docket} driver={staff[docket.staffId]} />
                ))}
                {proofs.length % 2 === 1 && <div className="hidden bg-white sm:block" />}
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
            title="Invoice customer"
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
              <DetailItem label="Invoice address">
                {customer.invoiceAddress ? (
                  <span className="block leading-relaxed">
                    {[customer.invoiceAddress.line1, customer.invoiceAddress.line2, customer.invoiceAddress.town, customer.invoiceAddress.county, customer.invoiceAddress.postcode, customer.invoiceAddress.country]
                      .filter(Boolean)
                      .map((p) => (
                        <span key={p} className="block">
                          {p}
                        </span>
                      ))}
                  </span>
                ) : (
                  customer.address
                )}
              </DetailItem>
            </DetailList>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function JobRecord({ title, docket, driver }: { title: string; docket: DeliveryDocket; driver?: string }) {
  return (
    <div className="space-y-3 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
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
            {docket.completedAt ? new Date(docket.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
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
