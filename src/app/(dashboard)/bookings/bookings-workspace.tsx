'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { BookingsCalendar, occupies } from './bookings-calendar';
import { GBP, unitDisplayStatus } from '@/lib/domain';
import { daysBetween, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CalendarRange, CircleAlert, List, PackageCheck, Search, SearchX, Truck, Warehouse, type LucideIcon } from 'lucide-react';
import type { BookingListItem } from '@/lib/actions';
import type { BookingWithDetails, Unit } from '@/types';

type View = 'timeline' | 'list';
type ListFilter = 'all' | 'upcoming' | 'onhire' | 'attention' | 'completed' | 'cancelled';

const FILTERS: { value: ListFilter; label: string; test: (b: BookingListItem) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'upcoming', label: 'Scheduled', test: (b) => b.status === 'CONFIRMED' },
  { value: 'onhire', label: 'On hire', test: (b) => b.status === 'ON_HIRE' },
  { value: 'attention', label: 'Late / overdue', test: (b) => b.lateDelivery || b.overdueCollection },
  { value: 'completed', label: 'Completed', test: (b) => b.status === 'COLLECTED' },
  { value: 'cancelled', label: 'Cancelled', test: (b) => b.status === 'CANCELLED' },
];

export function BookingsWorkspace({ bookings, allUnits, list, today }: { bookings: BookingWithDetails[]; allUnits: Unit[]; list: BookingListItem[]; today: string }) {
  const [view, setView] = useState<View>('timeline');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');

  const freeToday = allUnits.filter(
    (u) =>
      unitDisplayStatus(u) !== 'MAINTENANCE' &&
      !u.breakdown &&
      !bookings.some((b) => b.unitId === u.id && occupies(b, today, today))
  ).length;
  const count = (f: ListFilter) => list.filter(FILTERS.find((x) => x.value === f)!.test).length;
  const unitsIn = (f: ListFilter) => list.filter(FILTERS.find((x) => x.value === f)!.test).reduce((n, b) => n + b.lines.filter((l) => l.status !== 'CANCELLED').length, 0);

  const openList = (f: ListFilter) => {
    setFilter(f);
    setView('list');
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={PackageCheck} tone="sky" label="On hire" value={count('onhire')} sub={`${unitsIn('onhire')} units out`} onClick={() => openList('onhire')} />
        <Summary icon={Truck} tone="violet" label="Scheduled" value={count('upcoming')} sub={`${unitsIn('upcoming')} units to deliver`} onClick={() => openList('upcoming')} />
        <Summary
          icon={CircleAlert}
          tone={count('attention') ? 'red' : 'stone'}
          label="Late or overdue"
          value={count('attention')}
          sub={count('attention') ? 'Needs action' : 'All on time'}
          onClick={() => openList('attention')}
        />
        <Summary icon={Warehouse} tone="emerald" label="Free today" value={freeToday} sub={`of ${allUnits.length} units`} onClick={() => setView('timeline')} />
      </div>

      {/* View switch */}
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          value={view}
          onChange={setView}
          ariaLabel="View"
          options={[
            { value: 'timeline', label: 'Timeline', icon: <CalendarRange className="size-4" /> },
            { value: 'list', label: 'List', icon: <List className="size-4" />, count: list.length },
          ]}
        />
        {view === 'list' && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer, unit, site, PO or ref" className="h-9 bg-white pl-9" />
          </div>
        )}
      </div>

      {view === 'timeline' ? (
        <BookingsCalendar bookings={bookings} allUnits={allUnits} list={list} />
      ) : (
        <BookingsList list={list} filter={filter} onFilter={setFilter} query={query} onClearQuery={() => setQuery('')} today={today} />
      )}
    </div>
  );
}

const TONES = {
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  red: 'bg-red-50 text-red-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  stone: 'bg-stone-100 text-stone-500',
} as const;

function Summary({ icon: Icon, tone, label, value, sub, onClick }: { icon: LucideIcon; tone: keyof typeof TONES; label: string; value: number; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3.5 rounded-xl border bg-white p-4 text-left shadow-[var(--shadow-xs)] transition-all outline-none hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className={cn('tabular text-2xl leading-tight font-semibold tracking-tight', tone === 'red' ? 'text-red-600' : 'text-foreground')}>{value}</span>
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        </span>
      </span>
    </button>
  );
}

function BookingsList({
  list,
  filter,
  onFilter,
  query,
  onClearQuery,
  today,
}: {
  list: BookingListItem[];
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  query: string;
  onClearQuery: () => void;
  today: string;
}) {
  const router = useRouter();
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
    <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)]">
      <div className="scrollbar-thin overflow-x-auto border-b px-4 py-3">
        <SegmentedControl
          size="sm"
          value={filter}
          onChange={onFilter}
          ariaLabel="Booking status"
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: list.filter(f.test).length }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query ? 'No bookings match your search' : 'No bookings here'}
          description={query ? 'Try a customer name, unit code, site or PO number.' : 'Bookings in this status will appear here.'}
          action={
            query ? (
              <button onClick={onClearQuery} className="text-sm font-medium text-[var(--brand-red)] hover:underline">
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
    </section>
  );
}
