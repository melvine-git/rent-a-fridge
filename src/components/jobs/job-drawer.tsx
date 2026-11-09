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
import { completeJobs } from '@/lib/actions';
import { powerLabel, powerShort } from '@/lib/domain';
import { formatDate, formatDayDate, formatPhone, isValidW3w, normalizeW3w, w3wUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Check, CircleCheck, ExternalLink, MapPin, Navigation, Package, Phone, TriangleAlert } from 'lucide-react';
import type { BookingWithDetails, DeliveryChecklist, Staff } from '@/types';

export type JobType = 'delivery' | 'collection';

export interface JobTarget {
  /** Units of one booking handled on the same visit; the first one supplies site and contact. */
  bookings: BookingWithDetails[];
  type: JobType;
  /** Delivery checklists by booking id, so collections know what was left on site. */
  delivered?: Record<string, DeliveryChecklist | undefined>;
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
  | 'doorLockSecured'
  | 'tempRecorderFitted';

const NO_CHECKS: Record<CheckKey, boolean> = {
  unitClean: false,
  doorsSealed: false,
  tempVerified: false,
  powerConnected: false,
  powerSupplyChecked: false,
  powerCableConnected: false,
  hitchLockSecured: false,
  wheelClampSecured: false,
  doorLockSecured: false,
  tempRecorderFitted: false,
};

/** Accessories booked for a unit (delivery) or actually left on site (collection), for load lists. */
export function accessoryItems(booking: BookingWithDetails, left?: DeliveryChecklist): string[] {
  const acc = booking.accessories;
  const has = (fitted: boolean | undefined, booked: boolean | undefined) => (left ? !!fitted : !!booked);
  const cable = left ? left.cableLengthUsed : booking.cableLength;
  return [
    cable && `${cable} cable`,
    has(left?.hitchLockSecured, acc?.hitchLock) && 'Hitch lock',
    has(left?.wheelClampSecured, acc?.wheelClamp) && 'Wheel clamp',
    has(left?.doorLockSecured, acc?.doorLock) && 'Door lock',
    has(left?.tempRecorderFitted, acc?.tempRecorder) && 'Temperature recorder',
  ].filter((x): x is string => !!x);
}

function checklistFor(booking: BookingWithDetails, type: JobType, left?: DeliveryChecklist): { key: CheckKey; label: string }[] {
  const acc = booking.accessories;
  if (type === 'delivery') {
    return [
      { key: 'unitClean', label: 'Unit cleaned and inspected' },
      { key: 'doorsSealed', label: 'Door seals checked' },
      { key: 'powerSupplyChecked', label: `Site power verified (${powerLabel(booking)})` },
      { key: 'powerCableConnected', label: `Power cable connected${booking.cableLength ? ` (${booking.cableLength})` : ''}` },
      { key: 'powerConnected', label: 'Unit powered on and running' },
      { key: 'tempVerified', label: `Temperature set to ${booking.tempRequired}°C` },
      ...(acc?.hitchLock ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock fitted' }] : []),
      ...(acc?.wheelClamp ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp fitted' }] : []),
      ...(acc?.doorLock ? [{ key: 'doorLockSecured' as const, label: 'Door lock fitted' }] : []),
      ...(acc?.tempRecorder ? [{ key: 'tempRecorderFitted' as const, label: 'Temperature recorder fitted' }] : []),
    ];
  }
  // Recover whatever was actually fitted on delivery, falling back to what was booked
  const cable = left?.cableLengthUsed ?? booking.cableLength;
  return [
    { key: 'powerSupplyChecked', label: 'Power switched off at the supply' },
    { key: 'powerCableConnected', label: `Power cable recovered${cable ? ` (${cable})` : ''}` },
    { key: 'unitClean', label: 'Unit emptied and cleaned out' },
    { key: 'doorsSealed', label: 'Unit inspected for damage' },
    ...((left ? left.hitchLockSecured : acc?.hitchLock) ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock recovered' }] : []),
    ...((left ? left.wheelClampSecured : acc?.wheelClamp) ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp recovered' }] : []),
    ...((left ? left.doorLockSecured : acc?.doorLock) ? [{ key: 'doorLockSecured' as const, label: 'Door lock recovered' }] : []),
    ...((left ? left.tempRecorderFitted : acc?.tempRecorder) ? [{ key: 'tempRecorderFitted' as const, label: 'Temperature recorder recovered' }] : []),
  ];
}

/** Right-hand drawer for confirming a delivery or collection on site. */
export function JobDrawer({ job, staff, onClose, onCompleted }: { job: JobTarget | null; staff: Staff[]; onClose: () => void; onCompleted: () => void }) {
  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {job && job.bookings.length > 0 && <JobSheet key={job.bookings.map((b) => b.id).join() + job.type} job={job} staff={staff} onComplete={onCompleted} />}
      </SheetContent>
    </Sheet>
  );
}

function JobSheet({ job, staff, onComplete }: { job: JobTarget; staff: Staff[]; onComplete: () => void }) {
  const { bookings, type } = job;
  const site = bookings[0];
  const isDelivery = type === 'delivery';
  const multi = bookings.length > 1;
  const [isPending, startTransition] = useTransition();
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(bookings.map((b) => [b.id, true])));
  const [checked, setChecked] = useState<Record<string, Record<CheckKey, boolean>>>(() => Object.fromEntries(bookings.map((b) => [b.id, { ...NO_CHECKS }])));
  const [signedBy, setSignedBy] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [w3w, setW3w] = useState(site.what3wordsAddress ?? '');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');
  const drivers = staff.filter((s) => s.role === 'DRIVER');
  const [staffId, setStaffId] = useState(drivers[0]?.id ?? staff[0]?.id ?? '');

  const units = bookings.map((b) => ({ booking: b, items: checklistFor(b, type, job.delivered?.[b.id]) }));
  const active = units.filter((u) => included[u.booking.id]);
  const total = active.reduce((n, u) => n + u.items.length, 0);
  const done = active.reduce((n, u) => n + u.items.filter((i) => checked[u.booking.id][i.key]).length, 0);
  const w3wInvalid = w3w.trim() !== '' && !isValidW3w(w3w);
  const missing = [
    active.length === 0 && 'at least one unit',
    done < total && `${total - done} checklist item${total - done > 1 ? 's' : ''}`,
    !signedBy.trim() && 'name of person signing',
    !signature && 'signature',
    hasDamage && !damageNotes.trim() && 'damage description',
    w3wInvalid && 'valid what3words address',
  ].filter(Boolean) as string[];

  const handleConfirm = () => {
    startTransition(async () => {
      const left = (id: string) => job.delivered?.[id];
      const result = await completeJobs(
        isDelivery ? 'DELIVERY' : 'COLLECTION',
        active.map(({ booking }) => ({
          bookingId: booking.id,
          staffId,
          checklist: {
            ...checked[booking.id],
            // Collections record "recovered" against the same keys; power is off afterwards
            ...(isDelivery ? {} : { powerConnected: false }),
            tempSetting: isDelivery ? booking.tempRequired : 0,
            cableLengthUsed: isDelivery ? booking.cableLength : left(booking.id)?.cableLengthUsed,
          },
          tempSet: isDelivery ? booking.tempRequired : 0,
          signedBy: signedBy.trim(),
          signatureData: signature ?? undefined,
          what3wordsAddress: normalizeW3w(w3w),
          damageNotes: hasDamage ? damageNotes.trim() : undefined,
          photoUrls: [],
        }))
      );
      const codes = active.map((u) => u.booking.unit.id).join(', ');
      if (result.success) {
        toast.success(isDelivery ? 'Delivery confirmed' : 'Collection confirmed', {
          description: isDelivery ? `${codes} now on hire. Collection scheduled.` : `${codes} back and available.`,
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
          <span className="font-mono-unit text-xs text-muted-foreground">{site.groupId ?? site.id}</span>
        </div>
        <SheetTitle className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
          {!multi && <UnitTypeIcon type={site.unit.unitType} className="size-5" />}
          <span className="font-mono-unit">{bookings.map((b) => b.unit.id).join(' + ')}</span>
          <span className="font-normal text-muted-foreground">{isDelivery ? '→' : '←'}</span>
          <span className="truncate">{site.customer.name}</span>
        </SheetTitle>
        <SheetDescription>
          {isDelivery
            ? `${formatDayDate(site.startDate)}${site.deliveryTime ? ` at ${site.deliveryTime}` : ''}`
            : `On hire since ${formatDate(site.startDate)} · due back ${formatDate(site.endDate)}${site.collectionTime ? ` at ${site.collectionTime}` : ''}`}
        </SheetDescription>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Site */}
        <div className="rounded-md border p-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{site.deliveryAddress}</div>
              {site.what3wordsAddress && (
                <a href={w3wUrl(site.what3wordsAddress)} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-red)] hover:underline">
                  {site.what3wordsAddress} <ExternalLink className="size-3" />
                </a>
              )}
              {site.accessInstructions && <p className="mt-1 text-xs text-muted-foreground">{site.accessInstructions}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 border-t pt-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-foreground">{site.contactName}</div>
              <div className="tabular text-xs text-muted-foreground">{formatPhone(site.contactPhone)}</div>
            </div>
            <a href={`tel:${site.contactPhone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
              <Phone className="size-3.5" /> Call
            </a>
            <a
              href={site.what3wordsAddress ? w3wUrl(site.what3wordsAddress) : `https://maps.google.com/?q=${encodeURIComponent(site.deliveryAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
            >
              <Navigation className="size-3.5" /> Navigate
            </a>
          </div>
        </div>

        {/* Checklists, one per unit */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{isDelivery ? 'Handover checklist' : 'Collection checklist'}</h3>
            <span className="tabular text-xs text-muted-foreground">
              {done}/{total} complete
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <div className="space-y-3">
            {units.map(({ booking, items }) => {
              const on = included[booking.id];
              const load = accessoryItems(booking, isDelivery ? undefined : job.delivered?.[booking.id]);
              return (
                <section key={booking.id} className={cn('overflow-hidden rounded-md border', !on && 'opacity-60')}>
                  <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    <UnitTypeIcon type={booking.unit.unitType} />
                    <span className="font-mono-unit text-sm text-foreground">{booking.unit.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {booking.tempRequired}°C · {powerShort(booking)}
                    </span>
                    {multi && (
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground">
                        <input type="checkbox" checked={on} onChange={(e) => setIncluded((p) => ({ ...p, [booking.id]: e.target.checked }))} className="size-3.5 accent-[var(--brand-red)]" />
                        {isDelivery ? 'Delivering now' : 'Collecting now'}
                      </label>
                    )}
                  </header>
                  {on && (
                    <>
                      {load.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2 text-xs">
                          <Package className="size-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{isDelivery ? 'Load:' : 'Bring back:'}</span>
                          {load.map((l) => (
                            <span key={l} className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                      <ul className="divide-y">
                        {items.map((item) => {
                          const ticked = checked[booking.id][item.key];
                          return (
                            <li key={item.key}>
                              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={ticked}
                                  onChange={(e) => setChecked((p) => ({ ...p, [booking.id]: { ...p[booking.id], [item.key]: e.target.checked } }))}
                                />
                                <span
                                  className={cn(
                                    'flex size-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                                    ticked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-input bg-white'
                                  )}
                                >
                                  {ticked && <Check className="size-3.5" strokeWidth={3} />}
                                </span>
                                <span className={cn('text-sm', ticked ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>{item.label}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </section>
              );
            })}
          </div>
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
              placeholder="Describe the damage, which unit, where it is and any customer comments"
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
          <Link href={`/bookings/${site.groupId ?? site.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted">
            Booking <ArrowUpRight className="size-4" />
          </Link>
          <Button
            onClick={handleConfirm}
            disabled={missing.length > 0 || isPending}
            className={cn('h-10 flex-1 text-sm font-semibold', isDelivery ? 'hover:bg-[var(--brand-red-dark)]' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            <CircleCheck />
            {isPending ? 'Confirming…' : `Confirm ${isDelivery ? 'delivery' : 'collection'}${active.length > 1 ? ` (${active.length} units)` : ''}`}
          </Button>
        </div>
      </div>
    </>
  );
}
