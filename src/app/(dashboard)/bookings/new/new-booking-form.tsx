'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/app/segmented-control';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import { createBooking, getAvailableUnits, addCustomer, getCustomerAddresses, addCustomerAddress } from '@/lib/actions';
import { POWER_LABELS, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2, Plus, CalendarRange } from 'lucide-react';
import type { Customer, Unit, UnitType, CableLength, BookingAccessories, CustomerAddress, PowerType } from '@/types';

interface NewBookingFormProps {
  customers: Customer[];
  allUnits: Unit[];
  initialCustomerId?: string;
}

interface FormData {
  customerId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  deliveryTime: string;
  collectionTime: string;
  actionDate: string;
  actionDescription: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryAddressId: string;
  accessInstructions: string;
  tempRequired: string;
  powerAvailable: PowerType;
  cableLength: CableLength;
  accessories: BookingAccessories;
  application: string;
  notes: string;
}

const CABLE_LENGTHS: CableLength[] = ['5m', '10m', '15m', '20m', '25m', '30m'];

const ACCESSORIES: { key: keyof BookingAccessories; label: string; hint: string }[] = [
  { key: 'hitchLock', label: 'Hitch lock', hint: 'Trailer security' },
  { key: 'wheelClamp', label: 'Wheel clamp', hint: 'Prevents movement' },
  { key: 'doorLock', label: 'Door lock', hint: 'Padlock on doors' },
  { key: 'tempRecorder', label: 'Temperature recorder', hint: 'Logs temperatures' },
];

export function NewBookingForm({ customers, allUnits, initialCustomerId }: NewBookingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUnitIds, setAvailableUnitIds] = useState<Set<string>>(new Set());
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [customerList, setCustomerList] = useState<Customer[]>(customers);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const initialCustomer = customers.find((c) => c.id === initialCustomerId);
  const [unitTypeFilter, setUnitTypeFilter] = useState<UnitType | 'ALL'>(initialCustomer?.preferences?.preferredUnitType ?? 'ALL');

  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showNewAddressDialog, setShowNewAddressDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });

  const [formData, setFormData] = useState<FormData>(() => {
    const prefs = initialCustomer?.preferences;
    return {
      customerId: initialCustomer?.id ?? '',
      unitId: '',
      startDate: '',
      endDate: '',
      deliveryTime: '',
      collectionTime: '',
      actionDate: '',
      actionDescription: '',
      contactName: initialCustomer?.name ?? '',
      contactPhone: initialCustomer?.phone ?? '',
      deliveryAddress: initialCustomer?.address ?? '',
      deliveryAddressId: '',
      accessInstructions: '',
      tempRequired: prefs?.defaultTempRequired !== undefined ? String(prefs.defaultTempRequired) : '4',
      powerAvailable: 'STANDARD',
      cableLength: prefs?.preferredCableLength ?? '10m',
      accessories: { hitchLock: false, wheelClamp: false, doorLock: false, tempRecorder: false },
      application: '',
      notes: '',
    };
  });

  useEffect(() => {
    if (initialCustomerId) getCustomerAddresses(initialCustomerId).then(setCustomerAddresses);
  }, [initialCustomerId]);

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const datesValid = !!formData.startDate && !!formData.endDate && formData.endDate >= formData.startDate;

  useEffect(() => {
    if (!datesValid) return;
    let cancelled = false;
    async function check() {
      setIsCheckingAvailability(true);
      try {
        const available = await getAvailableUnits(formData.startDate, formData.endDate);
        if (!cancelled) setAvailableUnitIds(new Set(available.map((u) => u.id)));
      } finally {
        if (!cancelled) setIsCheckingAvailability(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [formData.startDate, formData.endDate, datesValid]);

  const selectCustomer = (customerId: string, list = customerList) => {
    const customer = list.find((c) => c.id === customerId);
    setCustomerAddresses([]);
    if (!customer) {
      updateField('customerId', '');
      return;
    }
    const prefs = customer.preferences;
    setFormData((prev) => ({
      ...prev,
      customerId,
      contactName: customer.name,
      contactPhone: customer.phone,
      deliveryAddress: customer.address,
      deliveryAddressId: '',
      tempRequired: prefs?.defaultTempRequired !== undefined ? String(prefs.defaultTempRequired) : prev.tempRequired,
      cableLength: prefs?.preferredCableLength ?? prev.cableLength,
    }));
    if (prefs?.preferredUnitType) setUnitTypeFilter(prefs.preferredUnitType);
    getCustomerAddresses(customerId).then(setCustomerAddresses);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone || !newCustomer.address) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const customer = await addCustomer(newCustomer);
      const list = [...customerList, customer];
      setCustomerList(list);
      selectCustomer(customer.id, list);
      setShowNewCustomerDialog(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      toast.success(`${customer.name} added`);
    } catch {
      toast.error('Failed to add customer');
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address || !formData.customerId) {
      toast.error('Please fill in all required fields');
      return;
    }
    const result = await addCustomerAddress(formData.customerId, newAddress);
    if (result.success && result.address) {
      setCustomerAddresses((prev) => [...prev, result.address!]);
      setFormData((prev) => ({ ...prev, deliveryAddressId: result.address!.id, deliveryAddress: result.address!.address }));
      setShowNewAddressDialog(false);
      setNewAddress({ label: '', address: '' });
      toast.success('Address saved');
    } else {
      toast.error('Failed to add address');
    }
  };

  const handleAddressSelect = (addressId: string) => {
    const addr = customerAddresses.find((a) => a.id === addressId);
    setFormData((prev) => ({ ...prev, deliveryAddressId: addressId, deliveryAddress: addr?.address ?? prev.deliveryAddress }));
  };

  const toggleAccessory = (key: keyof BookingAccessories) =>
    setFormData((prev) => ({ ...prev, accessories: { ...prev.accessories, [key]: !prev.accessories[key] } }));

  const getUnitAvailability = (unit: Unit): { disabled: boolean; label: string } => {
    if (unit.status === 'MAINTENANCE') return { disabled: true, label: 'In service' };
    if (!datesValid) return { disabled: false, label: unit.status === 'ON_HIRE' ? 'On hire now' : 'Available' };
    if (!availableUnitIds.has(unit.id)) return { disabled: true, label: 'Booked' };
    return { disabled: false, label: 'Available' };
  };

  const filteredUnits = allUnits
    .filter((u) => unitTypeFilter === 'ALL' || u.unitType === unitTypeFilter)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const selectedCustomer = customerList.find((c) => c.id === formData.customerId);
  const selectedUnit = allUnits.find((u) => u.id === formData.unitId);
  const selectedUnitBlocked = selectedUnit ? getUnitAvailability(selectedUnit).disabled : false;

  const checks = [
    { label: 'Customer selected', ok: !!formData.customerId },
    { label: 'Valid hire dates', ok: datesValid },
    { label: 'Available unit chosen', ok: !!formData.unitId && !selectedUnitBlocked },
    { label: 'Site contact & address', ok: !!formData.contactName && !!formData.contactPhone && !!formData.deliveryAddress },
  ];
  const ready = checks.every((c) => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setIsSubmitting(true);
    try {
      const result = await createBooking({
        customerId: formData.customerId,
        unitId: formData.unitId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        deliveryTime: formData.deliveryTime || undefined,
        collectionTime: formData.collectionTime || undefined,
        actionDate: formData.actionDate || undefined,
        actionDescription: formData.actionDescription || undefined,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        deliveryAddress: formData.deliveryAddress,
        deliveryAddressId: formData.deliveryAddressId || undefined,
        accessInstructions: formData.accessInstructions || undefined,
        tempRequired: parseInt(formData.tempRequired),
        powerAvailable: formData.powerAvailable,
        cableLength: formData.cableLength,
        accessories: formData.accessories,
        application: formData.application || undefined,
        notes: formData.notes || undefined,
      });
      if (result.success) {
        toast.success('Booking created', {
          description: `${formData.unitId} for ${selectedCustomer?.name}, ${formatDate(formData.startDate)} – ${formatDate(formData.endDate)}`,
        });
        router.push(result.booking ? `/bookings/${result.booking.id}` : '/bookings');
        router.refresh();
      } else {
        toast.error('Could not create booking', { description: result.error });
      }
    } catch {
      toast.error('Something went wrong', { description: 'Please try again' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* 1. Customer & dates */}
        <Section step={1} title="Customer & hire period" description="Who is hiring and for how long">
          <Field label="Invoice customer" required>
            <div className="flex gap-2">
              <select value={formData.customerId} onChange={(e) => selectCustomer(e.target.value)} className={selectClass} required>
                <option value="">Select a customer…</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={() => setShowNewCustomerDialog(true)} className="h-9 shrink-0 gap-1 px-3">
                <Plus /> New
              </Button>
            </div>
          </Field>
          {selectedCustomer?.preferences?.notes && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-600/15 ring-inset">
              <span className="font-semibold">Customer note:</span> {selectedCustomer.preferences.notes}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery date" required>
              <Input type="date" value={formData.startDate} onChange={(e) => updateField('startDate', e.target.value)} className="h-9" required />
            </Field>
            <Field label="Collection date" required>
              <Input
                type="date"
                value={formData.endDate}
                min={formData.startDate || undefined}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="h-9"
                aria-invalid={!!formData.endDate && !!formData.startDate && !datesValid}
                required
              />
            </Field>
            <Field label="Delivery time">
              <Input type="time" value={formData.deliveryTime} onChange={(e) => updateField('deliveryTime', e.target.value)} className="h-9" />
            </Field>
            <Field label="Collection time">
              <Input type="time" value={formData.collectionTime} onChange={(e) => updateField('collectionTime', e.target.value)} className="h-9" />
            </Field>
          </div>
          {formData.startDate && formData.endDate && !datesValid && (
            <p className="text-xs font-medium text-red-600">Collection date must be on or after the delivery date.</p>
          )}
        </Section>

        {/* 2. Unit */}
        <Section
          step={2}
          title="Unit"
          description={datesValid ? `Availability for ${formatDate(formData.startDate)} – ${formatDate(formData.endDate)}` : 'Set hire dates to check availability'}
          action={isCheckingAvailability && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        >
          <SegmentedControl
            size="sm"
            value={unitTypeFilter}
            onChange={setUnitTypeFilter}
            options={[
              { value: 'ALL', label: 'All types' },
              ...(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => {
                const Icon = UNIT_TYPE_ICON[t];
                return { value: t, label: UNIT_TYPE_LABELS[t], icon: <Icon className="size-3.5" /> };
              }),
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredUnits.map((unit) => {
              const { disabled, label } = getUnitAvailability(unit);
              const selected = formData.unitId === unit.id;
              const Icon = UNIT_TYPE_ICON[unit.unitType];
              return (
                <button
                  key={unit.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateField('unitId', unit.id)}
                  aria-pressed={selected}
                  className={cn(
                    'relative flex items-center gap-3 rounded-md border bg-white p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    disabled ? 'cursor-not-allowed bg-muted/40 opacity-60' : 'hover:border-foreground/30',
                    selected && 'border-[var(--brand-red)] ring-1 ring-[var(--brand-red)]'
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                    <Icon className="size-4 text-foreground/70" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-unit text-[13px] text-foreground">{unit.id}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {UNIT_SIZE_LABELS[unit.size]} · {unit.powerType === 'INDUSTRIAL' ? '32A' : '13A'}
                    </div>
                  </div>
                  {selected ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--brand-red)] text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className={cn('text-[11px] font-medium', label === 'Available' ? 'text-emerald-700' : 'text-muted-foreground')}>{label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 3. Site */}
        <Section step={3} title="Site & contact" description="Where the unit is going and who to call on the day">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site contact" required>
              <Input value={formData.contactName} onChange={(e) => updateField('contactName', e.target.value)} className="h-9" required />
            </Field>
            <Field label="Contact phone" required>
              <Input value={formData.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)} className="h-9" required />
            </Field>
          </div>
          <Field label="Delivery address" required>
            <div className="space-y-2">
              {customerAddresses.length > 0 && (
                <select value={formData.deliveryAddressId} onChange={(e) => handleAddressSelect(e.target.value)} className={selectClass}>
                  <option value="">Invoice address</option>
                  {customerAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} – {a.address}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Input
                  value={formData.deliveryAddress}
                  onChange={(e) => setFormData((p) => ({ ...p, deliveryAddress: e.target.value, deliveryAddressId: '' }))}
                  placeholder="Street, town, postcode"
                  className="h-9"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewAddress({ label: '', address: formData.deliveryAddress });
                    setShowNewAddressDialog(true);
                  }}
                  disabled={!formData.customerId}
                  className="h-9 shrink-0 gap-1 px-3"
                  title="Save as a new customer address"
                >
                  <Plus /> Save
                </Button>
              </div>
            </div>
          </Field>
          <Field label="Access instructions">
            <Input
              value={formData.accessInstructions}
              onChange={(e) => updateField('accessInstructions', e.target.value)}
              placeholder="e.g. Use rear gate, ring site manager on arrival"
              className="h-9"
            />
          </Field>
        </Section>

        {/* 4. Requirements */}
        <Section step={4} title="Requirements" description="Temperature, power and accessories">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Temperature (°C)" required>
              <Input type="number" min="-20" max="10" value={formData.tempRequired} onChange={(e) => updateField('tempRequired', e.target.value)} className="h-9" required />
            </Field>
            <Field label="Site power" required>
              <select value={formData.powerAvailable} onChange={(e) => updateField('powerAvailable', e.target.value as PowerType)} className={selectClass}>
                {(Object.keys(POWER_LABELS) as PowerType[]).map((p) => (
                  <option key={p} value={p}>
                    {POWER_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Application">
              <Input value={formData.application} onChange={(e) => updateField('application', e.target.value)} placeholder="e.g. fresh produce" className="h-9" />
            </Field>
          </div>
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">Power cable length</span>
            <SegmentedControl
              size="sm"
              value={formData.cableLength}
              onChange={(v) => updateField('cableLength', v)}
              options={CABLE_LENGTHS.map((l) => ({ value: l, label: l }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">Accessories</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACCESSORIES.map(({ key, label, hint }) => {
                const on = formData.accessories[key];
                return (
                  <label
                    key={key}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2.5 transition-colors hover:bg-muted/40', on && 'border-foreground/30')}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleAccessory(key)} className="peer sr-only" />
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                        on ? 'border-[var(--brand-red)] bg-[var(--brand-red)] text-white' : 'border-input'
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </Section>

        {/* 5. Follow-up */}
        <Section step={5} title="Follow-up & notes" description="Optional reminder and internal notes">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Action date" hint="Appears in alerts when due">
              <Input type="date" value={formData.actionDate} onChange={(e) => updateField('actionDate', e.target.value)} className="h-9" />
            </Field>
            <Field label="Action required">
              <Input
                value={formData.actionDescription}
                onChange={(e) => updateField('actionDescription', e.target.value)}
                placeholder="e.g. Confirm collection date with customer"
                className="h-9"
              />
            </Field>
          </div>
          <Field label="Internal notes">
            <textarea value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Anything the team should know" className={textareaClass} />
          </Field>
        </Section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <section className="surface overflow-hidden">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Booking summary</h2>
          </header>
          <dl className="divide-y text-sm">
            <SummaryRow label="Customer" value={selectedCustomer?.name} />
            <SummaryRow
              label="Hire period"
              value={datesValid ? `${formatDate(formData.startDate)} – ${formatDate(formData.endDate)}` : undefined}
              sub={datesValid ? `${daysBetween(formData.startDate, formData.endDate)} days` : undefined}
            />
            <SummaryRow
              label="Unit"
              value={selectedUnit ? <span className="font-mono-unit">{selectedUnit.id}</span> : undefined}
              sub={selectedUnit ? UNIT_TYPE_LABELS[selectedUnit.unitType] : undefined}
            />
            <SummaryRow label="Site" value={formData.deliveryAddress || undefined} />
            <SummaryRow label="Spec" value={`${formData.tempRequired}°C · ${formData.powerAvailable === 'INDUSTRIAL' ? '32A' : '13A'} · ${formData.cableLength}`} />
          </dl>
          <ul className="space-y-1.5 border-t bg-muted/30 px-4 py-3">
            {checks.map((c) => (
              <li key={c.label} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                {c.ok ? <Check className="size-3.5 text-emerald-600" strokeWidth={3} /> : <Circle className="size-3.5" />}
                {c.label}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => router.back()} className="h-10 px-4">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !ready} className="h-10 flex-1 gap-1.5 font-semibold hover:bg-[var(--brand-red-dark)]">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CalendarRange />}
              {isSubmitting ? 'Creating…' : 'Create booking'}
            </Button>
          </div>
        </section>
      </aside>

      {/* New customer */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add customer</DialogTitle>
            <DialogDescription>The new customer will be selected for this booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Company or name" required>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} className="h-9" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" required>
                <Input value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Email">
                <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} className="h-9" />
              </Field>
            </div>
            <Field label="Invoice address" required>
              <Input value={newCustomer.address} onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))} className="h-9" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewCustomerDialog(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button type="button" onClick={handleAddCustomer} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Add customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New address */}
      <Dialog open={showNewAddressDialog} onOpenChange={setShowNewAddressDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Save delivery address</DialogTitle>
            <DialogDescription>Saved to {selectedCustomer?.name ?? 'the customer'} for future bookings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Label" required>
              <Input value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Warehouse" className="h-9" />
            </Field>
            <Field label="Address" required>
              <Input
                value={newAddress.address}
                onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))}
                className="h-9"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewAddressDialog(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddAddress}
              className="h-9 px-4 hover:bg-[var(--brand-red-dark)]"
            >
              Save address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Section({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface overflow-hidden">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">{step}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">
        {value ? <span className="block truncate text-foreground">{value}</span> : <span className="text-muted-foreground/60">Not set</span>}
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}
