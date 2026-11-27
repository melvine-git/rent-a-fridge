'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/import-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { GBP } from '@/lib/domain';
import { daysBetween, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FileUp, Search, SearchX } from 'lucide-react';
import type { BookingListItem } from '@/lib/actions';

type ListFilter = 'all' | 'upcoming' | 'onhire' | 'attention' | 'completed' | 'cancelled';

const FILTERS: { value: ListFilter; label: string; test: (b: BookingListItem) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'upcoming', label: 'Scheduled', test: (b) => b.status === 'CONFIRMED' },
  { value: 'onhire', label: 'On hire', test: (b) => b.status === 'ON_HIRE' },
  { value: 'attention', label: 'Late / overdue', test: (b) => b.lateDelivery || b.overdueCollection },
  { value: 'completed', label: 'Completed', test: (b) => b.status === 'COLLECTED' },
  { value: 'cancelled', label: 'Cancelled', test: (b) => b.status === 'CANCELLED' },
];

/** The bookings table: status segments, search, CSV import, rows linking to booking detail. */
export function BookingsList({ list, today }: { list: BookingListItem[]; today: string }) {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const rows = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = FILTERS.find((f) => f.value === filter)!.test;
    const matched = list.filter((b) => {
      if (!test(b)) return false;
      const text = [b.reference, b.customer.name, b.contactName, b.deliveryAddress, b.poNumber, ...b.lines.map((l) => l.unitId)].join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    });
    // Work still to do reads soonest first; history reads newest first
    return filter === 'upcoming' || filter === 'onhire' || filter === 'attention' ? [...matched].sort((a, b) => a.startDate.localeCompare(b.startDate)) : matched;
  }, [list, filter, query]);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <div className="flex flex-col gap-3 border-b px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 xl:mx-0 xl:px-0">
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={setFilter}
            ariaLabel="Booking status"
            options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: list.filter(f.test).length }))}
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-md">
          <div className="relative w-full flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer, unit, site, PO or ref" className="h-9 w-full bg-white pl-9" />
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="h-9 w-full shrink-0 gap-1.5 px-3 sm:w-auto">
            <FileUp className="size-4" /> Import
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query ? 'No bookings match your search' : 'No bookings here'}
          description={query ? 'Try a customer name, unit code, site or PO number.' : 'Bookings in this status will appear here.'}
          action={
            query ? (
              <button onClick={() => setQuery('')} className="text-sm font-medium text-[var(--brand-red)] hover:underline">
                Clear search
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Booking</th>
                <th className="px-4 py-2.5 font-medium">Units</th>
                <th className="px-4 py-2.5 font-medium">Hire period</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Site</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Quoted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((b) => (
                <tr key={b.reference} onClick={() => router.push(`/bookings/${b.reference}`)} className="group cursor-pointer align-top transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.reference}`} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground group-hover:underline">
                      {b.customer.name}
                    </Link>
                    <div className="font-mono-unit text-[11px] font-normal text-muted-foreground">{b.reference}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[220px] flex-wrap gap-1.5">
                      {b.lines.map((l) => (
                        <span
                          key={l.id}
                          className={cn('inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5', l.status === 'CANCELLED' && 'opacity-50 line-through')}
                          title={l.status === 'CANCELLED' ? 'Removed from booking' : undefined}
                        >
                          <UnitTypeIcon type={l.unitType} className="size-3.5" />
                          <span className="font-mono-unit text-xs whitespace-nowrap text-foreground">{l.unitId}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="tabular px-4 py-3 whitespace-nowrap">
                    <div className="text-foreground">
                      {formatDate(b.startDate)} – {formatDate(b.endDate)}
                    </div>
                    <div className="text-xs text-muted-foreground">{daysBetween(b.startDate, b.endDate)} days</div>
                  </td>
                  <td className="hidden max-w-[240px] px-4 py-3 lg:table-cell">
                    <div className="truncate text-foreground">{b.deliveryAddress}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.contactName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={b.status} />
                      {b.paid && <span className="text-[11px] font-medium text-emerald-600">Paid · dispatch can proceed</span>}
                      {b.lateDelivery && <span className="text-[11px] font-medium text-red-600">Delivery late · {formatDate(b.lines.find((l) => l.status === 'CONFIRMED' && l.startDate < today)?.startDate)}</span>}
                      {b.overdueCollection && <span className="text-[11px] font-medium text-red-600">Collection overdue</span>}
                    </div>
                  </td>
                  <td className="tabular hidden px-4 py-3 text-right whitespace-nowrap md:table-cell">
                    {b.total !== null ? <span className="font-medium text-foreground">{GBP.format(b.total)}</span> : <span className="text-muted-foreground">Not priced</span>}
                    {b.poNumber && <div className="text-[11px] text-muted-foreground">PO {b.poNumber}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        Showing {rows.length} of {list.length} bookings
      </div>
      <ImportDialog kind="bookings" open={importOpen} onOpenChange={setImportOpen} onDone={() => router.refresh()} />
    </section>
  );
}
