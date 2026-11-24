
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { DetailItem, DetailList } from '@/components/app/detail';
import { EmptyState } from '@/components/app/empty-state';
import { Avatar } from '@/components/app/avatar';
import {
  Field,
  selectClass,
  textareaClass,
} from '@/components/app/field';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';

import {
  CustomerFields,
  customerDraftError,
  draftFromCustomer,
  draftToCustomer,
} from '@/components/customers/customer-fields';

import {
  updateCustomer,
  addCustomerAddress,
  deleteCustomerAddress,
  updateCustomerPreferences,
  deleteCustomer,
} from '@/lib/actions';

import { UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, formatDate, formatPhone } from '@/lib/format';

import {
  CalendarPlus,
  ExternalLink,
  History,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  Clock,
  ClipboardList,
  ArrowUpRight,
  Building2,
} from 'lucide-react';

import type {
  Customer,
  Booking,
  Unit,
  UnitType,
  CableLength,
  CustomerPreferences,
} from '@/types';

const CABLE_LENGTHS: CableLength[] = [
  '5m',
  '10m',
  '15m',
  '20m',
  '25m',
  '30m',
];

type Props = {
  customer: Customer;
  bookings: (Booking & { unit: Unit })[];
  preferredUnit: Unit | null;
  units: Unit[];
};

export function CustomerDetailView({
  customer,
  bookings,
  preferredUnit,
  units,
}: Props) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFromCustomer(customer));
  const [xeroContactId, setXeroContactId] = useState(
    customer.xeroContactId || ''
  );

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: '',
    address: '',
  });

  const [showPreferences, setShowPreferences] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [preferences, setPreferences] =
    useState<CustomerPreferences>(customer.preferences || {});

  // Derived data
  const active = bookings.filter((b) => b.status === 'ON_HIRE');
  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED');

  const extraAddresses = (customer.addresses ?? []).filter(
    (a) => a.address !== customer.address
  );

  const hireDays = bookings.reduce(
    (sum, b) => sum + daysBetween(b.startDate, b.endDate),
    0
  );

  const prefs = customer.preferences;

  const hasPrefs = !!(
    prefs &&
    (
      prefs.preferredUnitType ||
      prefs.preferredUnitId ||
      prefs.defaultTempRequired !== undefined ||
      prefs.preferredCableLength ||
      prefs.notes
    )
  );

  // Actions
  const handleSaveEdit = async () => {
    const error = customerDraftError(draft);

    if (error) {
      toast.error(error);
      return;
    }

    const result = await updateCustomer(customer.id, {
      ...draftToCustomer(draft),
      xeroContactId: xeroContactId.trim(),
    });

    if (result.success) {
      setIsEditing(false);
      toast.success('Customer updated');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to update');
    }
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
    } else {
      toast.error(result.error || 'Failed to add address');
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const result = await deleteCustomerAddress(
      customer.id,
      addressId
    );

    if (result.success) {
      toast.success('Address removed');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to remove address');
    }
  };

  const handleSavePreferences = async () => {
    const result = await updateCustomerPreferences(
      customer.id,
      preferences
    );

    if (result.success) {
      setShowPreferences(false);
      toast.success('Preferences saved');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to save preferences');
    }
  };

  const handleDeleteCustomer = async () => {
    const result = await deleteCustomer(customer.id);

    if (result.success) {
      toast.success(`${customer.name} deleted`);
      router.push('/customers');
      router.refresh();
    } else {
      setDeleteOpen(false);
      toast.error('Could not delete customer', {
        description: result.error ?? 'Please try again',
      });
    }
  };

  const openXero = () => {
    if (customer.xeroContactId) {
      window.open(
        `https://go.xero.com/Contacts/View/${encodeURIComponent(
          customer.xeroContactId
        )}`,
        '_blank',
        'noopener'
      );
    } else {
      setIsEditing(true);
    }
  };

  // Statistics
  const stats = [
    {
      label: 'Active hires',
      value: active.length,
      description: active.length
        ? active.map((b) => b.unit.id).join(', ')
        : 'No active hires',
      icon: Building2,
      iconStyle: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Upcoming bookings',
      value: upcoming.length,
      description: upcoming.length
        ? `Next ${formatDate(upcoming[0].startDate)}`
        : 'Nothing scheduled',
      icon: CalendarDays,
      iconStyle: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total bookings',
      value: bookings.length,
      description: `${hireDays} total hire days`,
      icon: ClipboardList,
      iconStyle: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Last hire',
      value: bookings[0]
        ? formatDate(bookings[0].startDate)
        : 'N/A',
      description: bookings[0]
        ? bookings[0].unit.id
        : 'No previous hire',
      icon: Clock,
      iconStyle: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Customer header */}
      <PageHeader
        breadcrumbs={[
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
        title={
          <div className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {customer.name}
              </h1>
              <p className="text-xs font-normal text-muted-foreground">
                Customer ID: {customer.id}
              </p>
            </div>
          </div>
        }
        description={`Customer since ${formatDate(customer.createdAt, {
          year: true,
        })}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="h-9 gap-1.5 px-3"
            >
              <Pencil className="size-4" />
              Edit
            </Button>

            <Button
              variant="outline"
              onClick={openXero}
              className="h-9 gap-1.5 px-3"
            >
              <Link2 className="size-4" />
              Xero
            </Button>

            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="h-9 gap-1.5 px-3 text-red-700 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>

            <Link
              href={`/bookings/new?customer=${encodeURIComponent(
                customer.id
              )}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-red-dark)]"
            >
              <CalendarPlus className="size-4" />
              Book for customer
            </Link>
          </>
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                </div>

                <div
                  className={`flex size-10 items-center justify-center rounded-lg ${stat.iconStyle}`}
                >
                  <Icon className="size-5" />
                </div>
              </div>

              <p className="mt-3 truncate text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">

          {/* Booking history */}
          <Panel
            title="Booking history"
            count={bookings.length}
          >
            {bookings.length === 0 ? (
              <EmptyState
                compact
                icon={History}
                title="No bookings yet"
                description="Bookings for this customer will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">
                        Booking
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Unit
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Hire period
                      </th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Site
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {bookings.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() =>
                          router.push(`/bookings/${b.id}`)
                        }
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                            {b.id}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <UnitTypeIcon type={b.unit.unitType} />
                            <UnitCode id={b.unit.id} />
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">
                            {formatDate(b.startDate)} – {formatDate(b.endDate)}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {daysBetween(b.startDate, b.endDate)} days ·{' '}
                            {b.tempRequired}°C
                          </p>
                        </td>

                        <td className="hidden max-w-[220px] truncate px-4 py-3 text-muted-foreground md:table-cell">
                          {b.deliveryAddress}
                        </td>

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

          {/* Delivery addresses */}
          <Panel
            title="Delivery addresses"
            count={extraAddresses.length + 1}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAddress(true)}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <Plus className="size-3.5" />
                Add address
              </Button>
            }
          >
            <div className="space-y-3 p-4">

              {/* Primary address */}
              <div className="flex items-start gap-3 rounded-lg border border-[var(--brand-red)]/20 bg-[var(--brand-red)]/[0.03] p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-red)] shadow-sm">
                  <MapPin className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      Invoice address
                    </p>

                    <span className="rounded-full bg-[var(--brand-red)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-red)]">
                      Primary
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {customer.address}
                  </p>
                </div>
              </div>

              {/* Additional addresses */}
              {extraAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-muted-foreground/30"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MapPin className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {addr.label}
                    </p>

                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {addr.address}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    aria-label={`Remove ${addr.label}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Contact details */}
          <Panel title="Contact details">
            <DetailList>
              <DetailItem label="Phone">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-2 tabular hover:text-[var(--brand-red)] hover:underline"
                >
                  <Phone className="size-3.5 text-muted-foreground" />
                  {formatPhone(customer.phone)}
                </a>
              </DetailItem>

              <DetailItem label="Email">
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-2 break-all hover:text-[var(--brand-red)] hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    Not provided
                  </span>
                )}
              </DetailItem>

              <DetailItem label="Invoice address">
                {customer.address}
              </DetailItem>

              <DetailItem label="Contact person">
                {customer.contactName ? (
                  <span>
                    {customer.contactName}
                    {customer.contactJobTitle && (
                      <span className="text-muted-foreground">
                        {' '}· {customer.contactJobTitle}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Not provided
                  </span>
                )}
              </DetailItem>

              {customer.contactPhone && (
                <DetailItem label="Contact phone">
                  <a
                    href={`tel:${customer.contactPhone}`}
                    className="inline-flex items-center gap-2 tabular hover:text-[var(--brand-red)] hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {formatPhone(customer.contactPhone)}
                  </a>
                </DetailItem>
              )}

              {customer.contactEmail && (
                <DetailItem label="Contact email">
                  <a
                    href={`mailto:${customer.contactEmail}`}
                    className="inline-flex items-center gap-2 break-all hover:text-[var(--brand-red)] hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    {customer.contactEmail}
                  </a>
                </DetailItem>
              )}
            </DetailList>
          </Panel>

          {/* Hire preferences */}
          <Panel
            title="Hire preferences"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            }
          >
            {hasPrefs ? (
              <DetailList>
                {preferredUnit && (
                  <DetailItem label="Preferred unit">
                    <Link
                      href={`/units/${preferredUnit.id}`}
                      className="inline-flex items-center gap-2 hover:text-[var(--brand-red)] hover:underline"
                    >
                      <UnitTypeIcon type={preferredUnit.unitType} />
                      <UnitCode id={preferredUnit.id} />
                      <span className="text-muted-foreground">
                        · {UNIT_TYPE_LABELS[preferredUnit.unitType]}
                      </span>
                    </Link>
                  </DetailItem>
                )}

                {prefs?.preferredUnitType && !preferredUnit && (
                  <DetailItem label="Preferred type">
                    {UNIT_TYPE_LABELS[prefs.preferredUnitType]}
                  </DetailItem>
                )}

                {prefs?.defaultTempRequired !== undefined && (
                  <DetailItem label="Default temperature">
                    {prefs.defaultTempRequired}°C
                  </DetailItem>
                )}

                {prefs?.preferredCableLength && (
                  <DetailItem label="Cable length">
                    {prefs.preferredCableLength}
                  </DetailItem>
                )}

                {prefs?.notes && (
                  <DetailItem label="Notes">
                    <span className="block rounded-md bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-600/15 ring-inset">
                      {prefs.notes}
                    </span>
                  </DetailItem>
                )}
              </DetailList>
            ) : (
              <div className="p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                  <ClipboardList className="size-5 text-muted-foreground" />
                </div>

                <p className="mt-3 text-sm font-medium">
                  No preferences set
                </p>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add preferences to pre-fill future bookings for this customer.
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreferences(true)}
                  className="mt-3 h-8"
                >
                  Add preferences
                </Button>
              </div>
            )}
          </Panel>

          {/* Accounting */}
          <Panel title="Accounting">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sm font-bold text-sky-600 ring-1 ring-sky-600/20">
                X
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Xero
                </p>

                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {customer.xeroContactId ? (
                    <span className="font-mono">
                      {customer.xeroContactId}
                    </span>
                  ) : (
                    'Not linked'
                  )}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={openXero}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                {customer.xeroContactId ? (
                  <>
                    Open
                    <ExternalLink className="size-3.5" />
                  </>
                ) : (
                  'Link'
                )}
              </Button>
            </div>
          </Panel>

          {/* Quick action */}
          <Link
            href={`/bookings/new?customer=${encodeURIComponent(customer.id)}`}
            className="group flex items-center justify-between rounded-xl border border-[var(--brand-red)]/20 bg-[var(--brand-red)]/[0.04] p-4 transition-colors hover:bg-[var(--brand-red)]/[0.08]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--brand-red)] text-white">
                <CalendarPlus className="size-5" />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Create a booking
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start a new hire for this customer
                </p>
              </div>
            </div>

            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Edit customer dialog */}
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (open) {
            setDraft(draftFromCustomer(customer));
            setXeroContactId(customer.xeroContactId || '');
          }

          setIsEditing(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit customer
            </DialogTitle>
            <DialogDescription>
              Update the customer's contact and accounting details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <CustomerFields
              value={draft}
              onChange={setDraft}
            />

            <Field
              label="Xero contact ID"
              hint="From the contact's page in Xero (the ID at the end of the web address)"
            >
              <Input
                value={xeroContactId}
                onChange={(e) => setXeroContactId(e.target.value)}
                placeholder="e.g. 7a4f2c1e-…"
                className="h-9 font-mono"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSaveEdit}
              className="h-9 px-4 hover:bg-[var(--brand-red-dark)]"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete customer dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Delete {customer.name}?
            </DialogTitle>

            <DialogDescription>
              This permanently removes the customer, their saved addresses
              and hire preferences. Customers with bookings cannot be deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>

            <Button
              onClick={handleDeleteCustomer}
              className="h-9 bg-red-600 px-4 hover:bg-red-700"
            >
              Delete customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add address dialog */}
      <Dialog
        open={showAddAddress}
        onOpenChange={setShowAddAddress}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Add delivery address
            </DialogTitle>

            <DialogDescription>
              Saved addresses can be selected when creating a booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Label" required>
              <Input
                value={newAddress.label}
                onChange={(e) =>
                  setNewAddress((p) => ({
                    ...p,
                    label: e.target.value,
                  }))
                }
                placeholder="e.g. Warehouse, Event venue"
                className="h-9"
              />
            </Field>

            <Field label="Address" required>
              <Input
                value={newAddress.address}
                onChange={(e) =>
                  setNewAddress((p) => ({
                    ...p,
                    address: e.target.value,
                  }))
                }
                placeholder="Street, town, postcode"
                className="h-9"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddAddress(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>

            <Button
              onClick={handleAddAddress}
              className="h-9 px-4 hover:bg-[var(--brand-red-dark)]"
            >
              Add address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hire preferences dialog */}
      <Dialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Hire preferences
            </DialogTitle>

            <DialogDescription>
              Used to pre-fill new bookings for {customer.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred unit type">
                <select
                  value={preferences.preferredUnitType || ''}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      preferredUnitType:
                        (e.target.value as UnitType) || undefined,
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">No preference</option>

                  {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {UNIT_TYPE_LABELS[t]}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Preferred unit">
                <select
                  value={preferences.preferredUnitId || ''}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      preferredUnitId: e.target.value || undefined,
                    }))
                  }
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
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      defaultTempRequired: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  className="h-9"
                />
              </Field>

              <Field label="Cable length">
                <select
                  value={preferences.preferredCableLength || ''}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      preferredCableLength:
                        (e.target.value as CableLength) || undefined,
                    }))
                  }
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
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    notes: e.target.value || undefined,
                  }))
                }
                placeholder="e.g. Prefers morning deliveries"
                className={textareaClass}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreferences(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSavePreferences}
              className="h-9 px-4 hover:bg-[var(--brand-red-dark)]"
            >
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
