'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/status-badge';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { SignaturePad } from '@/components/app/signature-pad';
import { markDelivered, markCollected } from '@/lib/actions';
import { POWER_LABELS } from '@/lib/domain';
import { formatDate, formatDayDate, formatPhone, isValidW3w, normalizeW3w, w3wUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Check, CircleCheck, ExternalLink, MapPin, Navigation, Phone, TriangleAlert } from 'lucide-react';
import type { BookingWithDetails, DeliveryChecklist, Staff } from '@/types';

export type JobType = 'delivery' | 'collection';

export interface JobTarget {
  booking: BookingWithDetails;
  type: JobType;
  /** Checklist from the delivery job, so collections know what was left on site. */
  deliveredChecklist?: DeliveryChecklist;
}

type CheckKey =
  | 'unitClean'
  | 'doorsSealed'
  | 'tempVerified'
  | 'powerConnected'
  | 'powerSupplyChecked'
  | 'powerCableConnected'
  | 'hitchLockSecured'
  | 'wheelClampSecured'
  | 'doorLockSecured';

function checklistFor({ booking, type, deliveredChecklist: left }: JobTarget): { key: CheckKey; label: string }[] {
  const acc = booking.accessories;
  if (type === 'delivery') {
    return [
      { key: 'unitClean', label: 'Unit cleaned and inspected' },
      { key: 'doorsSealed', label: 'Door seals checked' },
      { key: 'powerSupplyChecked', label: `Site power verified (${POWER_LABELS[booking.powerAvailable]})` },
      { key: 'powerCableConnected', label: `Power cable connected${booking.cableLength ? ` (${booking.cableLength})` : ''}` },
      { key: 'powerConnected', label: 'Unit powered on and running' },
      { key: 'tempVerified', label: `Temperature set to ${booking.tempRequired}°C` },
      ...(acc?.hitchLock ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock fitted' }] : []),
      ...(acc?.wheelClamp ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp fitted' }] : []),
      ...(acc?.doorLock ? [{ key: 'doorLockSecured' as const, label: 'Door lock fitted' }] : []),
    ];
  }
  // Recover whatever was actually fitted on delivery, falling back to what was booked
  const cable = left?.cableLengthUsed ?? booking.cableLength;
  return [
    { key: 'powerSupplyChecked', label: 'Power switched off at the supply' },
    { key: 'powerCableConnected', label: `Power cable recovered${cable ? ` (${cable})` : ''}` },
    { key: 'unitClean', label: 'Unit emptied and cleaned out' },
    { key: 'doorsSealed', label: 'Unit inspected for damage' },
    ...((left?.hitchLockSecured ?? acc?.hitchLock) ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock recovered' }] : []),
    ...((left?.wheelClampSecured ?? acc?.wheelClamp) ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp recovered' }] : []),
    ...((left?.doorLockSecured ?? acc?.doorLock) ? [{ key: 'doorLockSecured' as const, label: 'Door lock recovered' }] : []),
  ];
}

/** Right-hand drawer for confirming a delivery or collection on site. */
export function JobDrawer({ job, staff, onClose, onCompleted }: { job: JobTarget | null; staff: Staff[]; onClose: () => void; onCompleted: () => void }) {
  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {job && <JobSheet key={job.booking.id + job.type} job={job} staff={staff} onComplete={onCompleted} />}
      </SheetContent>
    </Sheet>
  );
}

function JobSheet({ job, staff, onComplete }: { job: JobTarget; staff: Staff[]; onComplete: () => void }) {
  const { booking, type } = job;
  const isDelivery = type === 'delivery';
  const [isPending, startTransition] = useTransition();
  const items = checklistFor(job);
  const [checked, setChecked] = useState<Record<CheckKey, boolean>>({
    unitClean: false,
    doorsSealed: false,
    tempVerified: false,
    powerConnected: false,
    powerSupplyChecked: false,
    powerCableConnected: false,
    hitchLockSecured: false,
    wheelClampSecured: false,
    doorLockSecured: false,
  });
  const [signedBy, setSignedBy] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [w3w, setW3w] = useState(booking.what3wordsAddress ?? '');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');
  const drivers = staff.filter((s) => s.role === 'DRIVER');
  const [staffId, setStaffId] = useState(drivers[0]?.id ?? staff[0]?.id ?? '');

  const done = items.filter((i) => checked[i.key]).length;
  const w3wInvalid = w3w.trim() !== '' && !isValidW3w(w3w);
  const missing = [
    done < items.length && `${items.length - done} checklist item${items.length - done > 1 ? 's' : ''}`,
    !signedBy.trim() && 'name of person signing',
    !signature && 'signature',
    hasDamage && !damageNotes.trim() && 'damage description',
    w3wInvalid && 'valid what3words address',
  ].filter(Boolean) as string[];

  const handleConfirm = () => {
    startTransition(async () => {
      const payload = {
        bookingId: booking.id,
        staffId,
        checklist: {
          ...checked,
          // Collections record "recovered" against the same keys; power is off afterwards
          ...(isDelivery ? {} : { powerConnected: false }),
          tempSetting: isDelivery ? booking.tempRequired : 0,
          cableLengthUsed: isDelivery ? booking.cableLength : job.deliveredChecklist?.cableLengthUsed,
        },
        tempSet: isDelivery ? booking.tempRequired : 0,
        signedBy: signedBy.trim(),
        signatureData: signature ?? undefined,
        what3wordsAddress: normalizeW3w(w3w),
        damageNotes: hasDamage ? damageNotes.trim() : undefined,
        photoUrls: [],
      };
      const result = isDelivery ? await markDelivered(payload) : await markCollected(payload);
      if (result.success) {
        toast.success(isDelivery ? 'Delivery confirmed' : 'Collection confirmed', {
          description: isDelivery ? `${booking.unit.id} is now on hire. A collection job has been scheduled.` : `${booking.unit.id} is back and available. Booking complete.`,
        });
        onComplete();
      } else {
        toast.error(`Could not confirm ${type}`, { description: result.error });
      }
    });
  };

  return (
    <>
      <SheetHeader className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Pill tone={isDelivery ? 'scheduled' : 'warning'} showDot>
            {isDelivery ? 'Delivery' : 'Collection'}
          </Pill>
          <span className="font-mono-unit text-xs text-muted-foreground">{booking.id}</span>
        </div>
        <SheetTitle className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
          <UnitTypeIcon type={booking.unit.unitType} className="size-5" />
          <span className="font-mono-unit">{booking.unit.id}</span>
          <span className="font-normal text-muted-foreground">{isDelivery ? '→' : '←'}</span>
          <span className="truncate">{booking.customer.name}</span>
        </SheetTitle>
        <SheetDescription>
          {isDelivery
            ? `${formatDayDate(booking.startDate)}${booking.deliveryTime ? ` at ${booking.deliveryTime}` : ''}`
            : `On hire since ${formatDate(booking.startDate)} · due back ${formatDate(booking.endDate)}${booking.collectionTime ? ` at ${booking.collectionTime}` : ''}`}
        </SheetDescription>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Site */}
        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{booking.deliveryAddress}</div>
                {booking.what3wordsAddress && (
                  <a href={w3wUrl(booking.what3wordsAddress)} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-red)] hover:underline">
                    {booking.what3wordsAddress} <ExternalLink className="size-3" />
                  </a>
                )}
                {booking.accessInstructions && <p className="mt-1 text-xs text-muted-foreground">{booking.accessInstructions}</p>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t pt-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground">{booking.contactName}</div>
                <div className="tabular text-xs text-muted-foreground">{formatPhone(booking.contactPhone)}</div>
              </div>
              <a href={`tel:${booking.contactPhone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                <Phone className="size-3.5" /> Call
              </a>
              <a
                href={booking.what3wordsAddress ? w3wUrl(booking.what3wordsAddress) : `https://maps.google.com/?q=${encodeURIComponent(booking.deliveryAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
              >
                <Navigation className="size-3.5" /> Navigate
              </a>
            </div>
          </div>

          {isDelivery && (
            <div className="grid grid-cols-3 divide-x rounded-md border text-center">
              <Spec label="Temperature" value={`${booking.tempRequired}°C`} />
              <Spec label="Power" value={booking.powerAvailable === 'INDUSTRIAL' ? '32A' : '13A'} />
              <Spec label="Cable" value={booking.cableLength ?? '—'} />
            </div>
          )}
        </div>

        {/* Checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{isDelivery ? 'Handover checklist' : 'Collection checklist'}</h3>
            <span className="tabular text-xs text-muted-foreground">
              {done}/{items.length} complete
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <ul className="divide-y rounded-md border">
            {items.map((item) => {
              const on = checked[item.key];
              return (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => setChecked((p) => ({ ...p, [item.key]: e.target.checked }))} />
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                        on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-input bg-white'
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn('text-sm', on ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Location + driver */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">what3words location</span>
            <div className="flex gap-2">
              <Input value={w3w} onChange={(e) => setW3w(e.target.value)} placeholder="///filled.count.soap" className="h-9" aria-invalid={w3wInvalid} />
              <a
                href={isValidW3w(w3w) ? w3wUrl(w3w) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!isValidW3w(w3w)}
                className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted', !isValidW3w(w3w) && 'pointer-events-none opacity-40')}
                aria-label="Open in what3words"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
            <span className={cn('block text-xs', w3wInvalid ? 'text-red-600' : 'text-muted-foreground')}>
              {w3wInvalid ? 'Use three words separated by dots' : `Exact spot where the unit was ${isDelivery ? 'left' : 'collected'}`}
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">Driver</span>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {(drivers.length ? drivers : staff).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Damage */}
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={hasDamage} onChange={(e) => setHasDamage(e.target.checked)} className="size-4 accent-[var(--brand-red)]" />
            <TriangleAlert className="size-4 text-amber-600" /> Report damage or issue
          </label>
          {hasDamage && (
            <textarea
              placeholder="Describe the damage, where it is on the unit and any customer comments"
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              className="min-h-20 w-full resize-none rounded-lg border border-input px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          )}
        </div>

        {/* Sign-off */}
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">
              Customer sign-off <span className="text-[var(--brand-red)]">*</span>
            </span>
            <Input placeholder="Full name of person signing" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="h-9" />
          </label>
          <SignaturePad value={signature} onChange={setSignature} />
        </div>
      </div>

      <div className="space-y-2 border-t bg-white px-5 py-4">
        {missing.length > 0 && <p className="text-xs text-muted-foreground">Still needed: {missing.join(', ')}</p>}
        <div className="flex items-center gap-2">
          <Link href={`/bookings/${booking.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted">
            Booking <ArrowUpRight className="size-4" />
          </Link>
          <Button
            onClick={handleConfirm}
            disabled={missing.length > 0 || isPending}
            className={cn('h-10 flex-1 text-sm font-semibold', isDelivery ? 'hover:bg-[var(--brand-red-dark)]' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            <CircleCheck />
            {isPending ? 'Confirming…' : isDelivery ? 'Confirm delivery' : 'Confirm collection'}
          </Button>
        </div>
      </div>
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="tabular text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
