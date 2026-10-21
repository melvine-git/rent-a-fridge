'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { Avatar } from '@/components/app/avatar';
import { Field } from '@/components/app/field';
import { Pill } from '@/components/ui/status-badge';
import { addCustomer } from '@/lib/actions';
import { formatDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Plus, Search, Users, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { CustomerWithStats } from '@/types';

interface CustomersViewProps {
  initialCustomers: CustomerWithStats[];
}

type SortKey = 'name' | 'lastBookingDate' | 'totalBookings';

export function CustomersView({ initialCustomers }: CustomersViewProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [segment, setSegment] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newCustomer = await addCustomer({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address,
      });
      setCustomers((prev) => [...prev, { ...newCustomer, activeHires: 0, totalBookings: 0 }]);
      toast.success('Customer added', { description: `${newCustomer.name} has been added` });
      setFormData({ name: '', phone: '', email: '', address: '' });
      setIsDialogOpen(false);
      router.refresh();
    } catch {
      toast.error('Failed to add customer', { description: 'Please try again' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers
      .filter((c) => (segment === 'all' ? true : segment === 'active' ? c.activeHires > 0 : c.activeHires === 0))
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
        return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
      });
  }, [customers, searchQuery, segment, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));

  const activeCount = customers.filter((c) => c.activeHires > 0).length;

  return (
    <>
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email or address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <SegmentedControl
              size="sm"
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'all', label: 'All', count: customers.length },
                { value: 'active', label: 'On hire', count: activeCount },
                { value: 'inactive', label: 'Inactive', count: customers.length - activeCount },
              ]}
            />
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="h-9 gap-1.5 px-3.5 hover:bg-[var(--brand-red-dark)]">
            <Plus /> Add customer
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? 'No matching customers' : 'No customers yet'}
            description={searchQuery ? 'Try a different search term or filter.' : 'Add your first customer to start taking bookings.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <SortTh label="Customer" active={sort.key === 'name'} onClick={() => toggleSort('name')} />
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Address</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <SortTh label="Bookings" align="right" active={sort.key === 'totalBookings'} onClick={() => toggleSort('totalBookings')} />
                  <SortTh label="Last hire" className="hidden md:table-cell" active={sort.key === 'lastBookingDate'} onClick={() => toggleSort('lastBookingDate')} />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/customers/${c.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">Customer since {formatDate(c.createdAt, { year: true })}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="tabular block whitespace-nowrap text-foreground hover:underline"
                      >
                        {formatPhone(c.phone)}
                      </a>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block max-w-[220px] truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {c.email}
                        </a>
                      )}
                    </td>
                    <td className="hidden max-w-[280px] px-4 py-3 lg:table-cell">
                      <span className="line-clamp-2 text-muted-foreground">{c.address}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.activeHires > 0 ? (
                        <Pill tone="info" showDot>
                          {c.activeHires} on hire
                        </Pill>
                      ) : (
                        <Pill tone="neutral">Inactive</Pill>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-foreground">{c.totalBookings}</td>
                    <td className="tabular hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDate(c.lastBookingDate)}
                    </td>
                    <td className="pr-4">
                      <ChevronRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Showing {rows.length} of {customers.length} customers
        </div>
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add customer</DialogTitle>
            <DialogDescription>Create a new account. You can add delivery addresses and preferences afterwards.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Company or name" required>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Hillside Catering"
                required
                className="h-9"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" required>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+44 28 …"
                  required
                  className="h-9"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@company.com"
                  className="h-9"
                />
              </Field>
            </div>
            <Field label="Invoice address" required>
              <Input
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="Street, town, postcode"
                required
                className="h-9"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-9 px-4">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
                {isSubmitting ? 'Adding…' : 'Add customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
    <th className={cn('px-4 py-2.5 font-medium', align === 'right' && 'text-right', className)}>
      <button
        onClick={onClick}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        <ArrowUpDown className={cn('size-3', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  );
}
