'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { SegmentedControl } from '@/components/app/segmented-control';
import { getAvailableUnits, updateBooking } from '@/lib/actions';
import { POWER_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { isValidW3w, normalizeW3w } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import type { BookingAccessories, BookingWithDetails, CableLength, PowerType, Unit } from '@/types';

const CABLE_LENGTHS: CableLength[] = ['5m', '10m', '15m', '20m', '25m', '30m'];
const ACCESSORIES: { key: keyof BookingAccessories; label: string }[] = [
  { key: 'hitchLock', label: 'Hitch lock' },
  { key: 'wheelClamp', label: 'Wheel clamp' },
  { key: 'doorLock', label: 'Door lock' },
  { key: 'tempRecorder', label: 'Temperature recorder' },
];

function initialState(b: BookingWithDetails) {
  return {
    unitId: b.unitId,
    startDate: b.startDate,
    endDate: b.endDate,
    deliveryTime: b.deliveryTime ?? '',
    collectionTime: b.collectionTime ?? '',
    contactName: b.contactName,
    contactPhone: b.contactPhone,
    deliveryAddress: b.deliveryAddress,
    what3wordsAddress: b.what3wordsAddress ?? '',
    accessInstructions: b.accessInstructions ?? '',
    tempRequired: String(b.tempRequired),
    powerAvailable: b.powerAvailable,
    cableLength: b.cableLength ?? ('10m' as CableLength),
    accessories: b.accessories ?? { hitchLock: false, wheelClamp: false, doorLock: false, tempRecorder: false },
    application: b.application ?? '',
    notes: b.notes ?? '',
    actionDate: b.actionDate ?? '',
    actionDescription: b.actionDescription ?? '',
  };
}

export function EditBookingSheet({
  booking,
  units,
  open,
  onOpenChange,
  onSaved,
}: {
  booking: BookingWithDetails;
  units: Unit[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => initialState(booking));
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [isPending, startTransition] = useTransition();
  const onHire = booking.status === 'ON_HIRE';
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const datesValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate;
  const w3wInvalid = form.what3wordsAddress.trim() !== '' && !isValidW3w(form.what3wordsAddress);

  useEffect(() => {
    if (!open || onHire || !datesValid) return;
    let cancelled = false;
    getAvailableUnits(form.startDate, form.endDate, undefined, booking.id).then((list) => {
      if (!cancelled) setAvailable(new Set(list.map((u) => u.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [open, onHire, datesValid, form.startDate, form.endDate, booking.id]);

  const unitBlocked = !onHire && available !== null && !available.has(form.unitId);
  const canSave = datesValid && !w3wInvalid && !unitBlocked && !!form.contactName && !!form.contactPhone && !!form.deliveryAddress;

  const save = () =>
    startTransition(async () => {
      const result = await updateBooking(booking.id, {
        ...(onHire ? {} : { unitId: form.unitId, startDate: form.startDate }),
        endDate: form.endDate,
        deliveryTime: form.deliveryTime || undefined,
        collectionTime: form.collectionTime || undefined,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        deliveryAddress: form.deliveryAddress.trim(),
        what3wordsAddress: normalizeW3w(form.what3wordsAddress),
        accessInstructions: form.accessInstructions.trim() || undefined,
        tempRequired: parseInt(form.tempRequired),
        powerAvailable: form.powerAvailable,
        cableLength: form.cableLength,
        accessories: form.accessories,
        application: form.application.trim() || undefined,
        notes: form.notes.trim() || undefined,
        actionDate: form.actionDate || undefined,
        actionDescription: form.actionDescription.trim() || undefined,
      });
      if (result.success) {
        toast.success('Booking updated');
        onSaved();
      } else {
        toast.error('Could not save changes', { description: result.error });
      }
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setForm(initialState(booking));
        onOpenChange(o);
      }}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base font-semibold">Edit booking</SheetTitle>
          <SheetDescription>
            {booking.customer.name} · <span className="font-mono-unit">{booking.id}</span>
            {onHire && ' · unit is on hire, so the unit and delivery date are locked'}
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Group title="Dates & unit">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery date" required>
                <Input type="date" value={form.startDate} disabled={onHire} onChange={(e) => set('startDate', e.target.value)} className="h-9" />
              </Field>
              <Field label="Collection date" required>
                <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} className="h-9" aria-invalid={!datesValid} />
              </Field>
              <Field label="Delivery time">
                <Input type="time" value={form.deliveryTime} onChange={(e) => set('deliveryTime', e.target.value)} className="h-9" />
              </Field>
              <Field label="Collection time">
                <Input type="time" value={form.collectionTime} onChange={(e) => set('collectionTime', e.target.value)} className="h-9" />
              </Field>
            </div>
            {!datesValid && <p className="text-xs font-medium text-red-600">Collection date must be on or after the delivery date.</p>}
            <Field label="Unit" required>
              <select value={form.unitId} disabled={onHire} onChange={(e) => set('unitId', e.target.value)} className={selectClass}>
                {units
                  .slice()
                  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
                  .map((u) => {
                    const free = onHire || available === null || available.has(u.id) || u.id === booking.unitId;
                    return (
                      <option key={u.id} value={u.id} disabled={!free && u.id !== form.unitId}>
                        {u.id} · {UNIT_TYPE_LABELS[u.unitType]}
                        {!free ? ' (unavailable)' : ''}
                      </option>
                    );
                  })}
              </select>
              {unitBlocked && <span className="block text-xs font-medium text-red-600">This unit isn’t available for the new dates. Choose another unit.</span>}
            </Field>
          </Group>

          <Group title="Site & contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site contact" required>
                <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className="h-9" />
              </Field>
              <Field label="Contact phone" required>
                <Input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} className="h-9" />
              </Field>
            </div>
            <Field label="Delivery address" required>
              <Input value={form.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} className="h-9" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="what3words location">
                <Input value={form.what3wordsAddress} onChange={(e) => set('what3wordsAddress', e.target.value)} placeholder="///filled.count.soap" className="h-9" aria-invalid={w3wInvalid} />
                {w3wInvalid && <span className="block text-xs text-red-600">Use three words separated by dots</span>}
              </Field>
              <Field label="Access instructions">
                <Input value={form.accessInstructions} onChange={(e) => set('accessInstructions', e.target.value)} className="h-9" />
              </Field>
            </div>
          </Group>

          <Group title="Requirements">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Temperature (°C)">
                <Input type="number" min="-20" max="10" value={form.tempRequired} onChange={(e) => set('tempRequired', e.target.value)} className="h-9" />
              </Field>
              <Field label="Site power">
                <select value={form.powerAvailable} onChange={(e) => set('powerAvailable', e.target.value as PowerType)} className={selectClass}>
                  {(Object.keys(POWER_LABELS) as PowerType[]).map((p) => (
                    <option key={p} value={p}>
                      {POWER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Application">
                <Input value={form.application} onChange={(e) => set('application', e.target.value)} className="h-9" />
              </Field>
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-medium text-foreground">Cable length</span>
              <SegmentedControl size="sm" value={form.cableLength} onChange={(v) => set('cableLength', v)} options={CABLE_LENGTHS.map((l) => ({ value: l, label: l }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACCESSORIES.map(({ key, label }) => {
                const on = form.accessories[key];
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => set('accessories', { ...form.accessories, [key]: !on })} />
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                        on ? 'border-[var(--brand-red)] bg-[var(--brand-red)] text-white' : 'border-input'
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {label}
                  </label>
                );
              })}
            </div>
          </Group>

          <Group title="Follow-up & notes">
            <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
              <Field label="Action date">
                <Input type="date" value={form.actionDate} onChange={(e) => set('actionDate', e.target.value)} className="h-9" />
              </Field>
              <Field label="Action required">
                <Input value={form.actionDescription} onChange={(e) => set('actionDescription', e.target.value)} className="h-9" />
              </Field>
            </div>
            <Field label="Internal notes">
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className={textareaClass} />
            </Field>
          </Group>
        </div>

        <div className="flex gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-4">
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || isPending} className="h-10 flex-1 gap-1.5 font-semibold hover:bg-[var(--brand-red-dark)]">
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
