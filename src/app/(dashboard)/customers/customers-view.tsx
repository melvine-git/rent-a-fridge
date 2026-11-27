
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { Avatar } from '@/components/app/avatar';

import {
  CustomerFields,
  customerDraftError,
  draftToCustomer,
  emptyCustomerDraft,
} from '@/components/customers/customer-fields';

import { Pill } from '@/components/ui/status-badge';
import { addCustomer } from '@/lib/actions';
import { ImportDialog } from '@/components/import/import-dialog';

import { formatDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

import {
  Plus,
  Search,
  Users,
  ChevronRight,
  ArrowUpDown,
  FileUp,
  UserPlus,
  UserCheck,
  UserX,
  ClipboardList,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

import type { CustomerWithStats } from '@/types';

type CustomersViewProps = {
  initialCustomers: CustomerWithStats[];
};

type SortKey = 'name' | 'lastBookingDate' | 'totalBookings';

export function CustomersView({
  initialCustomers,
}: CustomersViewProps) {
  const router = useRouter();

  // Locally-added customers not yet in refreshed props
  const [added, setAdded] = useState<CustomerWithStats[]>([]);

  const customers = useMemo(() => {
    const ids = new Set(initialCustomers.map((c) => c.id));

    return [
      ...initialCustomers,
      ...added.filter((c) => !ids.has(c.id)),
    ];
  }, [initialCustomers, added]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [segment, setSegment] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const [sort, setSort] = useState<{
    key: SortKey;
    dir: 1 | -1;
  }>({
    key: 'name',
    dir: 1,
  });

  const [draft, setDraft] = useState(emptyCustomerDraft);

  // Submit new customer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = customerDraftError(draft);

    if (error) {
      toast.error(error);
      return;
    }

    setIsSubmitting(true);

    try {
      const newCustomer = await addCustomer(
        draftToCustomer(draft)
      );

      setAdded((prev) => [
        ...prev,
        {
          ...newCustomer,
          activeHires: 0,
          totalBookings: 0,
        },
      ]);

      toast.success('Customer added', {
        description: `${newCustomer.name} has been added`,
      });

      setDraft(emptyCustomerDraft());
      setIsDialogOpen(false);

      router.refresh();
    } catch {
      toast.error('Failed to add customer', {
        description: 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search, filter and sort
  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return customers
      .filter((c) =>
        segment === 'all'
          ? true
          : segment === 'active'
            ? c.activeHires > 0
            : c.activeHires === 0
      )
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
          c.email?.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[sort.key] ?? '';
        const bv = b[sort.key] ?? '';

        return (
          (
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv))
          ) * sort.dir
        );
      });
  }, [customers, searchQuery, segment, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: key === 'name' ? 1 : -1 }
    );

  // Summary statistics
  const activeCount = customers.filter(
    (c) => c.activeHires > 0
  ).length;

  const inactiveCount = customers.length - activeCount;

  const totalBookings = customers.reduce(
    (sum, c) => sum + c.totalBookings,
    0
  );

  const stats = [
    {
      label: 'Total customers',
      value: customers.length,
      description: 'All registered customers',
      icon: Users,
      iconStyle: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Active customers',
      value: activeCount,
      description: 'Currently have units on hire',
      icon: UserCheck,
      iconStyle: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Inactive customers',
      value: inactiveCount,
      description: 'No active hires currently',
      icon: UserX,
      iconStyle: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total bookings',
      value: totalBookings,
      description: 'Bookings across all customers',
      icon: ClipboardList,
      iconStyle: 'bg-violet-50 text-violet-600',
    },
  ];

  return (
    <>
      <div className="space-y-6">

        {/* Page introduction */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Customers
              </h1>

              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {customers.length}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage customer accounts, contact information and hire history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-9 gap-2 px-3.5"
            >
              <FileUp className="size-4" />
              Import customers
            </Button>

            <Button
              onClick={() => setIsDialogOpen(true)}
              className="h-9 gap-2 px-3.5 hover:bg-(--brand-red-dark)"
            >
              <Plus className="size-4" />
              Add customer
            </Button>
          </div>
        </div>

        {/* Summary cards */}
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

                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-lg',
                      stat.iconStyle
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Customer directory */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">

          {/* Search and filters */}
          <div className="flex flex-col gap-4 border-b p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">

                {/* Search */}
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    placeholder="Search name, phone, email or address"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-9 pr-9"
                  />

                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <SegmentedControl
                  size="sm"
                  value={segment}
                  onChange={setSegment}
                  options={[
                    {
                      value: 'all',
                      label: 'All',
                      count: customers.length,
                    },
                    {
                      value: 'active',
                      label: 'On hire',
                      count: activeCount,
                    },
                    {
                      value: 'inactive',
                      label: 'Inactive',
                      count: inactiveCount,
                    },
                  ]}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {rows.length} result{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Table */}
          {rows.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Users}
                title={
                  searchQuery
                    ? 'No matching customers'
                    : 'No customers yet'
                }
                description={
                  searchQuery
                    ? 'Try a different search term or filter.'
                    : 'Add your first customer to start taking bookings.'
                }
              />

              {searchQuery && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSegment('all');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <SortTh
                      label="Customer"
                      active={sort.key === 'name'}
                      onClick={() => toggleSort('name')}
                    />

                    <th className="px-4 py-3 font-medium">
                      Contact
                    </th>

                    <th className="hidden px-4 py-3 font-medium lg:table-cell">
                      Address
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Status
                    </th>

                    <SortTh
                      label="Bookings"
                      align="right"
                      active={sort.key === 'totalBookings'}
                      onClick={() => toggleSort('totalBookings')}
                    />

                    <SortTh
                      label="Last hire"
                      className="hidden md:table-cell"
                      active={sort.key === 'lastBookingDate'}
                      onClick={() => toggleSort('lastBookingDate')}
                    />

                    <th className="w-10" />
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() =>
                        router.push(`/customers/${c.id}`)
                      }
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />

                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {c.name}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Since {formatDate(c.createdAt, {
                                year: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          <a
                            href={`tel:${c.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 whitespace-nowrap text-foreground hover:text-(--brand-red) hover:underline"
                          >
                            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                            {formatPhone(c.phone)}
                          </a>

                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex max-w-55 items-center gap-2 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                            >
                              <Mail className="size-3.5 shrink-0" />
                              <span className="truncate">
                                {c.email}
                              </span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Address */}
                      <td className="hidden max-w-70 px-4 py-3.5 lg:table-cell">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />

                          <span className="line-clamp-2 text-muted-foreground">
                            {c.address}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {c.activeHires > 0 ? (
                          <Pill tone="info" showDot>
                            {c.activeHires} on hire
                          </Pill>
                        ) : (
                          <Pill tone="neutral">
                            Inactive
                          </Pill>
                        )}
                      </td>

                      {/* Bookings */}
                      <td className="tabular px-4 py-3.5 text-right">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-muted px-2 py-1 font-medium">
                          {c.totalBookings}
                        </span>
                      </td>

                      {/* Last hire */}
                      <td className="tabular hidden px-4 py-3.5 whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDate(c.lastBookingDate)}
                      </td>

                      {/* Navigation */}
                      <td className="pr-4">
                        <ChevronRight className="size-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {rows.length} of {customers.length} customers
            </span>

            <span>
              {activeCount} active · {inactiveCount} inactive
            </span>
          </div>
        </section>
      </div>

      {/* Add customer dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);

          if (!open) {
            setDraft(emptyCustomerDraft());
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-(--brand-red)/10 text-(--brand-red)">
              <UserPlus className="size-5" />
            </div>

            <DialogTitle className="text-base font-semibold">
              Add customer
            </DialogTitle>

            <DialogDescription>
              Create a new customer account. You can add delivery addresses
              and hire preferences afterwards.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <CustomerFields
              value={draft}
              onChange={setDraft}
            />

            <div className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">
                What&apos;s next?
              </p>
              After creating this customer, you can add additional delivery
              addresses, set hire preferences and create bookings.
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 px-4"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 gap-2 px-4 hover:bg-(--brand-red-dark)"
              >
                {isSubmitting ? (
                  'Adding…'
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add customer
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer import */}
      <ImportDialog
        kind="customers"
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => router.refresh()}
      />
    </>
  );
}

// Sortable table heading
function SortTh({
  label,
  active,
  onClick,
  align = 'left',
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={cn(
        'px-4 py-3 font-medium',
        align === 'right' && 'text-right',
        className
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 transition-colors hover:text-foreground',
          active && 'text-foreground'
        )}
      >
        {label}

        <ArrowUpDown
          className={cn(
            'size-3',
            active ? 'opacity-100' : 'opacity-40'
          )}
        />
      </button>
    </th>
  );
}
