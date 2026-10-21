'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { DetailItem, DetailList, StatStrip } from '@/components/app/detail';
import { EmptyState } from '@/components/app/empty-state';
import { Avatar } from '@/components/app/avatar';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { updateCustomer, addCustomerAddress, deleteCustomerAddress, updateCustomerPreferences } from '@/lib/actions';
import { UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, formatDate, formatPhone } from '@/lib/format';
import { CalendarPlus, ExternalLink, History, Link2, MapPin, Pencil, Plus, Trash2, Phone, Mail } from 'lucide-react';
import type { Customer, Booking, Unit, UnitType, CableLength, CustomerPreferences } from '@/types';

const CABLE_LENGTHS: CableLength[] = ['5m', '10m', '15m', '20m', '25m', '30m'];

interface Props {
  customer: Customer;
  bookings: (Booking & { unit: Unit })[];
  preferredUnit: Unit | null;
  units: Unit[];
}

export function CustomerDetailView({ customer, bookings, preferredUnit, units }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || '',
    address: customer.address,
    xeroContactId: customer.xeroContactId || '',
  });
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CustomerPreferences>(customer.preferences || {});

  const active = bookings.filter((b) => b.status === 'ON_HIRE');
  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED');
  const extraAddresses = (customer.addresses ?? []).filter((a) => a.address !== customer.address);
  const hireDays = bookings.reduce((sum, b) => sum + daysBetween(b.startDate, b.endDate), 0);

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim() || !editForm.address.trim()) {
      toast.error('Name, phone and invoice address are required');
      return;
    }
    const result = await updateCustomer(customer.id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      address: editForm.address.trim(),
      xeroContactId: editForm.xeroContactId.trim() || undefined,
    });
    if (result.success) {
      setIsEditing(false);
      toast.success('Customer updated');
      router.refresh();
    } else toast.error(result.error || 'Failed to update');
  };

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address) {
      toast.error('Enter a label and address');
      return;
    }
    const result = await addCustomerAddress(customer.id, newAddress);
    if (result.success) {
      setShowAddAddress(false);
      setNewAddress({ label: '', address: '' });
      toast.success('Address added');
      router.refresh();
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const result = await deleteCustomerAddress(customer.id, addressId);
    if (result.success) {
      toast.success('Address removed');
      router.refresh();
    }
  };

  const handleSavePreferences = async () => {
    const result = await updateCustomerPreferences(customer.id, preferences);
    if (result.success) {
      setShowPreferences(false);
      toast.success('Preferences saved');
      router.refresh();
    }
  };

  const openXero = () => {
    if (customer.xeroContactId) window.open(`https://go.xero.com/Contacts/View/${encodeURIComponent(customer.xeroContactId)}`, '_blank', 'noopener');
    else setIsEditing(true);
  };

  const prefs = customer.preferences;
  const hasPrefs = !!(prefs && (prefs.preferredUnitType || prefs.preferredUnitId || prefs.defaultTempRequired !== undefined || prefs.preferredCableLength || prefs.notes));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Customers', href: '/customers' }, { label: customer.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            {customer.name}
          </span>
        }
        description={`Customer since ${formatDate(customer.createdAt, { year: true })}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsEditing(true)} className="h-9 gap-1.5 px-3">
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={openXero} className="h-9 gap-1.5 px-3">
              <Link2 /> Xero
            </Button>
            <Link
              href={`/bookings/new?customer=${encodeURIComponent(customer.id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium hover:bg-muted"
            >
              <CalendarPlus className="size-4" /> Book for this customer
            </Link>
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'On hire now', value: active.length, sub: active.length ? active.map((b) => b.unit.id).join(', ') : 'No active hires' },
          { label: 'Upcoming', value: upcoming.length, sub: upcoming[0] ? `Next ${formatDate(upcoming[upcoming.length - 1].startDate)}` : 'None scheduled' },
          { label: 'Total bookings', value: bookings.length, sub: `${hireDays} hire days` },
          { label: 'Last hire', value: formatDate(bookings[0]?.startDate), sub: bookings[0] ? <span className="font-mono-unit">{bookings[0].unit.id}</span> : undefined },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Panel title="Booking history" count={bookings.length}>
            {bookings.length === 0 ? (
              <EmptyState compact icon={History} title="No bookings yet" description="Bookings for this customer will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Booking</th>
                      <th className="px-4 py-2.5 font-medium">Unit</th>
                      <th className="px-4 py-2.5 font-medium">Hire period</th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">Site</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bookings.map((b) => (
                      <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)} className="cursor-pointer hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <span className="font-mono-unit text-xs text-muted-foreground">{b.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <UnitTypeIcon type={b.unit.unitType} />
                            <UnitCode id={b.unit.id} />
                          </span>
                        </td>
                        <td className="tabular px-4 py-3 whitespace-nowrap text-foreground">
                          {formatDate(b.startDate)} – {formatDate(b.endDate)}
                          <div className="text-xs text-muted-foreground">
                            {daysBetween(b.startDate, b.endDate)} days · {b.tempRequired}°C
                          </div>
                        </td>
                        <td className="hidden max-w-[220px] truncate px-4 py-3 text-muted-foreground md:table-cell">{b.deliveryAddress}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Delivery addresses"
            count={extraAddresses.length + 1}
            action={
              <Button variant="outline" size="sm" onClick={() => setShowAddAddress(true)} className="h-8 gap-1 px-2.5 text-xs">
                <Plus /> Add address
              </Button>
            }
          >
            <ul className="divide-y">
              <li className="flex items-start gap-3 px-4 py-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    Invoice address <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">Primary</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{customer.address}</p>
                </div>
              </li>
              {extraAddresses.map((addr) => (
                  <li key={addr.id} className="group flex items-start gap-3 px-4 py-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{addr.label}</div>
                      <p className="text-sm text-muted-foreground">{addr.address}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      aria-label={`Remove ${addr.label}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Panel title="Contact details">
            <DetailList>
              <DetailItem label="Phone">
                <a href={`tel:${customer.phone}`} className="tabular inline-flex items-center gap-1.5 hover:underline">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {formatPhone(customer.phone)}
                </a>
              </DetailItem>
              <DetailItem label="Email">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 break-all hover:underline">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </DetailItem>
              <DetailItem label="Invoice address">{customer.address}</DetailItem>
            </DetailList>
          </Panel>

          <Panel
            title="Hire preferences"
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowPreferences(true)} className="h-7 gap-1 px-2 text-xs">
                <Pencil /> Edit
              </Button>
            }
          >
            {hasPrefs ? (
              <DetailList>
                {preferredUnit && (
                  <DetailItem label="Preferred unit">
                    <Link href={`/units/${preferredUnit.id}`} className="inline-flex items-center gap-2 hover:underline">
                      <UnitTypeIcon type={preferredUnit.unitType} />
                      <UnitCode id={preferredUnit.id} />
                      <span className="text-muted-foreground">· {UNIT_TYPE_LABELS[preferredUnit.unitType]}</span>
                    </Link>
                  </DetailItem>
                )}
                {prefs?.preferredUnitType && !preferredUnit && <DetailItem label="Preferred type">{UNIT_TYPE_LABELS[prefs.preferredUnitType]}</DetailItem>}
                {prefs?.defaultTempRequired !== undefined && <DetailItem label="Default temperature">{prefs.defaultTempRequired}°C</DetailItem>}
                {prefs?.preferredCableLength && <DetailItem label="Cable length">{prefs.preferredCableLength}</DetailItem>}
                {prefs?.notes && (
                  <DetailItem label="Notes">
                    <span className="block rounded-md bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-600/15 ring-inset">{prefs.notes}</span>
                  </DetailItem>
                )}
              </DetailList>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No preferences set. Preferences pre-fill new bookings for this customer.</p>
            )}
          </Panel>

          <Panel title="Accounting">
            <div className="flex items-center gap-3 p-4">
              <span className="flex size-9 items-center justify-center rounded-md bg-sky-50 text-xs font-bold text-sky-600 ring-1 ring-sky-600/20">X</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Xero</div>
                <div className="truncate text-xs text-muted-foreground">
                  {customer.xeroContactId ? <span className="font-mono">{customer.xeroContactId}</span> : 'Not linked'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={openXero} className="h-8 gap-1 px-2.5 text-xs">
                {customer.xeroContactId ? (
                  <>
                    Open <ExternalLink className="size-3.5" />
                  </>
                ) : (
                  'Link'
                )}
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Edit customer */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Company or name" required>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="h-9" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" required>
                <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Email">
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="h-9" />
              </Field>
            </div>
            <Field label="Invoice address" required>
              <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} className="h-9" />
            </Field>
            <Field label="Xero contact ID" hint="From the contact's page in Xero (the ID at the end of the web address)">
              <Input
                value={editForm.xeroContactId}
                onChange={(e) => setEditForm((p) => ({ ...p, xeroContactId: e.target.value }))}
                placeholder="e.g. 7a4f2c1e-…"
                className="h-9 font-mono"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add address */}
      <Dialog open={showAddAddress} onOpenChange={setShowAddAddress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add delivery address</DialogTitle>
            <DialogDescription>Saved addresses can be selected when creating a booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Label" required>
              <Input value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Warehouse, Event venue" className="h-9" />
            </Field>
            <Field label="Address" required>
              <Input value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} placeholder="Street, town, postcode" className="h-9" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAddress(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleAddAddress} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Add address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preferences */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Hire preferences</DialogTitle>
            <DialogDescription>Used to pre-fill new bookings for {customer.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred unit type">
                <select
                  value={preferences.preferredUnitType || ''}
                  onChange={(e) => setPreferences((p) => ({ ...p, preferredUnitType: (e.target.value as UnitType) || undefined }))}
                  className={selectClass}
                >
                  <option value="">No preference</option>
                  {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                    <option key={t} value={t}>
                      {UNIT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred unit">
                <select
                  value={preferences.preferredUnitId || ''}
                  onChange={(e) => setPreferences((p) => ({ ...p, preferredUnitId: e.target.value || undefined }))}
                  className={selectClass}
                >
                  <option value="">No preference</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id} · {UNIT_TYPE_LABELS[u.unitType]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default temperature (°C)">
                <Input
                  type="number"
                  min="-20"
                  max="10"
                  value={preferences.defaultTempRequired ?? ''}
                  onChange={(e) => setPreferences((p) => ({ ...p, defaultTempRequired: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="h-9"
                />
              </Field>
              <Field label="Cable length">
                <select
                  value={preferences.preferredCableLength || ''}
                  onChange={(e) => setPreferences((p) => ({ ...p, preferredCableLength: (e.target.value as CableLength) || undefined }))}
                  className={selectClass}
                >
                  <option value="">No preference</option>
                  {CABLE_LENGTHS.map((len) => (
                    <option key={len} value={len}>
                      {len}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={preferences.notes || ''}
                onChange={(e) => setPreferences((p) => ({ ...p, notes: e.target.value || undefined }))}
                placeholder="e.g. Prefers morning deliveries"
                className={textareaClass}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreferences(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSavePreferences} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
