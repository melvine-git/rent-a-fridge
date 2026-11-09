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
import { CustomerFields, customerDraftError, draftToCustomer, emptyCustomerDraft } from '@/components/customers/customer-fields';
import {
  ContactAndPowerFields,
  LinesEditor,
  QuoteEditor,
  QuoteTotals,
  emptyQuote,
  lineError,
  lineToInput,
  newLine,
  quoteToInput,
  siteError,
  type LineDraft,
  type QuoteDraft,
  type SiteDraft,
} from '@/components/bookings/booking-editors';
import { createBooking, getAvailableUnits, addCustomer, getCustomerAddresses, addCustomerAddress, checkBookingLines } from '@/lib/actions';
import { UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, powerShort, quoteTotals } from '@/lib/domain';
import { formatDate, isValidW3w, normalizeW3w } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2, Plus, CalendarRange } from 'lucide-react';
import type { Customer, Unit, UnitType, CustomerAddress } from '@/types';

interface NewBookingFormProps {
  customers: Customer[];
  allUnits: Unit[];
  initialCustomerId?: string;
}

interface Defaults {
  startDate: string;
  endDate: string;
  deliveryTime: string;
  collectionTime: string;
}

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
  const [newCustomer, setNewCustomer] = useState(emptyCustomerDraft);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });

  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? '');
  const [defaults, setDefaults] = useState<Defaults>({ startDate: '', endDate: '', deliveryTime: '', collectionTime: '' });
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string | null>>({});
  // Site contact is deliberately blank: it's usually a person on site, not the hirer
  const [site, setSite] = useState<SiteDraft>({
    contactName: '',
    contactPhone: '',
    deliveryAddress: initialCustomer?.address ?? '',
    what3wordsAddress: '',
    accessInstructions: '',
    powerAvailable: 'STANDARD',
    powerOther: '',
    application: '',
  });
  const [deliveryAddressId, setDeliveryAddressId] = useState('');
  const [followUp, setFollowUp] = useState({ actionDate: '', actionDescription: '', notes: '' });
  const [quote, setQuote] = useState<QuoteDraft>(emptyQuote);

  const selectedCustomer = customerList.find((c) => c.id === customerId);
  const prefs = selectedCustomer?.preferences;

  useEffect(() => {
    if (initialCustomerId) getCustomerAddresses(initialCustomerId).then(setCustomerAddresses);
  }, [initialCustomerId]);

  const datesValid = !!defaults.startDate && !!defaults.endDate && defaults.endDate >= defaults.startDate;

  // Picker availability uses the booking's default dates
  useEffect(() => {
    if (!datesValid) return;
    let cancelled = false;
    async function check() {
      setIsCheckingAvailability(true);
      try {
        const available = await getAvailableUnits(defaults.startDate, defaults.endDate);
        if (!cancelled) setAvailableUnitIds(new Set(available.map((u) => u.id)));
      } finally {
        if (!cancelled) setIsCheckingAvailability(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [defaults.startDate, defaults.endDate, datesValid]);

  // Each line can have its own dates, so check every line against the fleet
  const linesKey = JSON.stringify(lines.map((l) => [l.key, l.unitId, l.startDate, l.endDate]));
  useEffect(() => {
    const ready = lines.filter((l) => l.startDate && l.endDate);
    if (ready.length === 0) return;
    let cancelled = false;
    checkBookingLines(ready.map(lineToInput)).then((res) => {
      if (!cancelled) setConflicts(Object.fromEntries(ready.map((l, i) => [l.key, res[i]])));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linesKey captures the fields that matter
  }, [linesKey]);

  const setDefault = <K extends keyof Defaults>(k: K, v: string) => {
    const previous = defaults[k];
    setDefaults((d) => ({ ...d, [k]: v }));
    // Lines that still follow the booking's dates move with them
    setLines((ls) => ls.map((l) => (l[k] === previous ? { ...l, [k]: v } : l)));
  };

  const updateLine = useCallback((key: string, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);
  const removeLine = useCallback((key: string) => setLines((ls) => ls.filter((l) => l.key !== key)), []);

  const toggleUnit = (unit: Unit) => {
    if (lines.some((l) => l.unitId === unit.id)) {
      setLines((ls) => ls.filter((l) => l.unitId !== unit.id));
      return;
    }
    setLines((ls) => [
      ...ls,
      newLine(unit, {
        ...defaults,
        tempRequired: prefs?.defaultTempRequired !== undefined ? String(prefs.defaultTempRequired) : undefined,
        cableLength: prefs?.preferredCableLength,
      }),
    ]);
  };

  const selectCustomer = (id: string, list = customerList) => {
    const customer = list.find((c) => c.id === id);
    setCustomerAddresses([]);
    setDeliveryAddressId('');
    setCustomerId(customer?.id ?? '');
    if (!customer) return;
    setSite((s) => ({ ...s, deliveryAddress: customer.address }));
    if (customer.preferences?.preferredUnitType) setUnitTypeFilter(customer.preferences.preferredUnitType);
    getCustomerAddresses(customer.id).then(setCustomerAddresses);
  };

  const handleAddCustomer = async () => {
    const error = customerDraftError(newCustomer);
    if (error) {
      toast.error(error);
      return;
    }
    setIsAddingCustomer(true);
    try {
      const customer = await addCustomer(draftToCustomer(newCustomer));
      const list = [...customerList, customer];
      setCustomerList(list);
      selectCustomer(customer.id, list);
      setShowNewCustomerDialog(false);
      setNewCustomer(emptyCustomerDraft());
      toast.success(`${customer.name} added`);
    } catch {
      toast.error('Failed to add customer', { description: 'Please try again' });
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address || !customerId) {
      toast.error('Please fill in all required fields');
      return;
    }
    const result = await addCustomerAddress(customerId, newAddress);
    if (result.success && result.address) {
      setCustomerAddresses((prev) => [...prev, result.address!]);
      setDeliveryAddressId(result.address.id);
      setSite((s) => ({ ...s, deliveryAddress: result.address!.address }));
      setShowNewAddressDialog(false);
      setNewAddress({ label: '', address: '' });
      toast.success('Address saved');
    } else {
      toast.error('Failed to add address');
    }
  };

  const handleAddressSelect = (addressId: string) => {
    const addr = customerAddresses.find((a) => a.id === addressId);
    setDeliveryAddressId(addressId);
    setSite((s) => ({ ...s, deliveryAddress: addr?.address ?? selectedCustomer?.address ?? s.deliveryAddress }));
  };

  const unitState = (unit: Unit): { disabled: boolean; label: string } => {
    if (unit.breakdown) return { disabled: true, label: 'Breakdown' };
    if (unit.status === 'MAINTENANCE') return { disabled: true, label: 'In service' };
    if (!datesValid) return { disabled: false, label: unit.status === 'ON_HIRE' ? 'On hire now' : 'Available' };
    if (!availableUnitIds.has(unit.id)) return { disabled: !lines.some((l) => l.unitId === unit.id), label: 'Booked' };
    return { disabled: false, label: 'Available' };
  };

  const filteredUnits = allUnits
    .filter((u) => unitTypeFilter === 'ALL' || u.unitType === unitTypeFilter)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const linesOk = lines.length > 0 && lines.every((l) => !lineError(l) && !conflicts[l.key]);
  const problem = siteError(site);
  const checks = [
    { label: 'Customer selected', ok: !!customerId },
    { label: lines.length > 1 ? `${lines.length} units, all available` : 'Unit chosen and available', ok: linesOk },
    { label: 'Site contact, phone & address', ok: !problem },
  ];
  const ready = checks.every((c) => c.ok);
  const totals = quoteTotals(
    lines.map((l) => ({ ...lineToInput(l), status: 'CONFIRMED' as const })),
    quoteToInput(quote)
  );
  const allDates = lines.flatMap((l) => [l.startDate, l.endDate]).filter(Boolean).sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setIsSubmitting(true);
    try {
      const result = await createBooking({
        customerId,
        contactName: site.contactName.trim(),
        contactPhone: site.contactPhone.trim(),
        deliveryAddress: site.deliveryAddress.trim(),
        deliveryAddressId: deliveryAddressId || undefined,
        what3wordsAddress: normalizeW3w(site.what3wordsAddress),
        accessInstructions: site.accessInstructions.trim() || undefined,
        powerAvailable: site.powerAvailable,
        powerOther: site.powerOther,
        application: site.application.trim() || undefined,
        notes: followUp.notes.trim() || undefined,
        actionDate: followUp.actionDate || undefined,
        actionDescription: followUp.actionDescription.trim() || undefined,
        quote: quoteToInput(quote),
        lines: lines.map(lineToInput),
      });
      if (result.success) {
        toast.success('Booking created', {
          description: `${lines.map((l) => l.unitId).join(', ')} for ${selectedCustomer?.name}`,
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

  const w3wInvalid = site.what3wordsAddress.trim() !== '' && !isValidW3w(site.what3wordsAddress);

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* 1. Customer & dates */}
        <Section step={1} title="Customer & hire period" description="Who is being invoiced and the usual delivery and collection dates">
          <Field label="Invoice customer" required>
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => selectCustomer(e.target.value)} className={selectClass} required>
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
          {prefs?.notes && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-600/15 ring-inset">
              <span className="font-semibold">Customer note:</span> {prefs.notes}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery date" required>
              <Input type="date" value={defaults.startDate} onChange={(e) => setDefault('startDate', e.target.value)} className="h-9" />
            </Field>
            <Field label="Collection date" required>
              <Input
                type="date"
                value={defaults.endDate}
                min={defaults.startDate || undefined}
                onChange={(e) => setDefault('endDate', e.target.value)}
                className="h-9"
                aria-invalid={!!defaults.endDate && !!defaults.startDate && !datesValid}
              />
            </Field>
            <Field label="Delivery time">
              <Input type="time" value={defaults.deliveryTime} onChange={(e) => setDefault('deliveryTime', e.target.value)} className="h-9" />
            </Field>
            <Field label="Collection time">
              <Input type="time" value={defaults.collectionTime} onChange={(e) => setDefault('collectionTime', e.target.value)} className="h-9" />
            </Field>
          </div>
          {defaults.startDate && defaults.endDate && !datesValid && <p className="text-xs font-medium text-red-600">Collection date must be on or after the delivery date.</p>}
        </Section>

        {/* 2. Units */}
        <Section
          step={2}
          title="Units"
          description={
            datesValid
              ? `Pick one or more units. Availability for ${formatDate(defaults.startDate)} – ${formatDate(defaults.endDate)}`
              : 'Pick one or more units. Set hire dates to check availability'
          }
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
              const { disabled, label } = unitState(unit);
              const selected = lines.some((l) => l.unitId === unit.id);
              const Icon = UNIT_TYPE_ICON[unit.unitType];
              return (
                <button
                  key={unit.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleUnit(unit)}
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
                      {UNIT_TYPE_LABELS[unit.unitType]} · {UNIT_SIZE_LABELS[unit.size]}
                    </div>
                  </div>
                  {selected ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--brand-red)] text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className={cn('text-[11px] font-medium', label === 'Available' ? 'text-emerald-700' : label === 'Breakdown' ? 'text-red-600' : 'text-muted-foreground')}>{label}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-foreground">Units on this booking ({lines.length})</h3>
              {lines.length > 1 && <span className="text-xs text-muted-foreground">Change a unit&apos;s dates if it goes out or comes back separately</span>}
            </div>
            <LinesEditor lines={lines} units={allUnits} conflicts={conflicts} onChange={updateLine} onRemove={removeLine} />
          </div>
        </Section>

        {/* 3. Site */}
        <Section step={3} title="Site & contact" description="Where the units are going and who to call on the day">
          <ContactAndPowerFields value={site} onChange={(patch) => setSite((s) => ({ ...s, ...patch }))} />
          <Field label="Delivery address" required>
            <div className="space-y-2">
              {customerAddresses.length > 0 && (
                <select value={deliveryAddressId} onChange={(e) => handleAddressSelect(e.target.value)} className={selectClass}>
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
                  value={site.deliveryAddress}
                  onChange={(e) => {
                    setSite((s) => ({ ...s, deliveryAddress: e.target.value }));
                    setDeliveryAddressId('');
                  }}
                  placeholder="Street, town, postcode"
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewAddress({ label: '', address: site.deliveryAddress });
                    setShowNewAddressDialog(true);
                  }}
                  disabled={!customerId}
                  className="h-9 shrink-0 gap-1 px-3"
                  title="Save as a new customer address"
                >
                  <Plus /> Save
                </Button>
              </div>
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <Field label="what3words location" hint={w3wInvalid ? undefined : 'Exact drop-off spot on site'}>
              <Input
                value={site.what3wordsAddress}
                onChange={(e) => setSite((s) => ({ ...s, what3wordsAddress: e.target.value }))}
                placeholder="///filled.count.soap"
                className="h-9"
                aria-invalid={w3wInvalid}
              />
              {w3wInvalid && <span className="block text-xs text-red-600">Use three words separated by dots</span>}
            </Field>
            <Field label="Access instructions">
              <Input
                value={site.accessInstructions}
                onChange={(e) => setSite((s) => ({ ...s, accessInstructions: e.target.value }))}
                placeholder="e.g. Use rear gate, ring site manager on arrival"
                className="h-9"
              />
            </Field>
          </div>
        </Section>

        {/* 4. Pricing */}
        <Section step={4} title="Pricing" description="Quoted to the customer, used to raise the invoice">
          <QuoteEditor lines={lines} value={quote} onChange={setQuote} />
        </Section>

        {/* 5. Follow-up */}
        <Section step={5} title="Follow-up & notes" description="Optional reminder and internal notes">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Action date" hint="Appears in alerts when due">
              <Input type="date" value={followUp.actionDate} onChange={(e) => setFollowUp((f) => ({ ...f, actionDate: e.target.value }))} className="h-9" />
            </Field>
            <Field label="Action required">
              <Input
                value={followUp.actionDescription}
                onChange={(e) => setFollowUp((f) => ({ ...f, actionDescription: e.target.value }))}
                placeholder="e.g. Confirm collection date with customer"
                className="h-9"
              />
            </Field>
          </div>
          <Field label="Internal notes">
            <textarea value={followUp.notes} onChange={(e) => setFollowUp((f) => ({ ...f, notes: e.target.value }))} placeholder="Anything the team should know" className={textareaClass} />
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
            <SummaryRow label="Hire period" value={allDates.length ? `${formatDate(allDates[0])} – ${formatDate(allDates.at(-1))}` : undefined} />
            <SummaryRow
              label={lines.length > 1 ? 'Units' : 'Unit'}
              value={lines.length ? <span className="font-mono-unit">{lines.map((l) => l.unitId).join(', ')}</span> : undefined}
            />
            <SummaryRow label="Site" value={site.deliveryAddress || undefined} />
            <SummaryRow label="Contact" value={site.contactName || undefined} sub={site.contactPhone || undefined} />
            <SummaryRow label="Power" value={powerShort(site)} />
          </dl>
          {lines.length > 0 && (
            <div className="border-t p-3">
              <QuoteTotals totals={totals} />
            </div>
          )}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add customer</DialogTitle>
            <DialogDescription>The new customer will be selected for this booking.</DialogDescription>
          </DialogHeader>
          <CustomerFields value={newCustomer} onChange={setNewCustomer} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewCustomerDialog(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button type="button" onClick={handleAddCustomer} disabled={isAddingCustomer} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              {isAddingCustomer ? 'Adding…' : 'Add customer'}
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
              <Input value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} className="h-9" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowNewAddressDialog(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button type="button" onClick={handleAddAddress} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
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
