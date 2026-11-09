'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/app/segmented-control';
import { EmptyState } from '@/components/app/empty-state';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import { CalendarPlus, ChevronRight, LayoutGrid, List, PackageSearch, Plus, Search, TriangleAlert, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { addUnit } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, unitDisplayStatus, type UnitDisplayStatus } from '@/lib/domain';
import { daysBetween, daysFromToday, formatDate } from '@/lib/format';
import type { UnitType, UnitSize, UnitWithHire } from '@/types';

interface UnitsViewProps {
  units: UnitWithHire[];
}

const TYPE_TINT: Record<UnitType, string> = {
  COLD_STORE: 'bg-sky-50 text-sky-700',
  UPRIGHT_FRIDGE: 'bg-teal-50 text-teal-700',
  CHEST_FREEZER: 'bg-indigo-50 text-indigo-700',
};

const outOfAction = (u: UnitWithHire) => !!u.breakdown || u.status === 'MAINTENANCE';

export function UnitsView({ units }: UnitsViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | UnitDisplayStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'table' | 'grid'>('table');
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ id: '', size: 'MEDIUM' as UnitSize, unitType: 'COLD_STORE' as UnitType, notes: '' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter(
      (u) =>
        (statusFilter === 'all' || unitDisplayStatus(u) === statusFilter) &&
        (typeFilter === 'all' || u.unitType === typeFilter) &&
        (!q ||
          u.id.toLowerCase().includes(q) ||
          u.currentHire?.customerName.toLowerCase().includes(q) ||
          u.nextBooking?.customerName.toLowerCase().includes(q) ||
          u.notes?.toLowerCase().includes(q) ||
          u.specifications?.chassisNumber?.toLowerCase().includes(q))
    );
  }, [units, statusFilter, typeFilter, query]);

  const inType = typeFilter === 'all' ? units : units.filter((u) => u.unitType === typeFilter);
  const count = (s: UnitDisplayStatus) => inType.filter((u) => unitDisplayStatus(u) === s).length;

  const handleAddUnit = async () => {
    if (!newUnit.id) {
      toast.error('Please enter a unit ID');
      return;
    }
    const result = await addUnit(newUnit);
    if (result.success) {
      toast.success(`Unit ${newUnit.id} added to fleet`);
      setShowAddUnit(false);
      setNewUnit({ id: '', size: 'MEDIUM', unitType: 'COLD_STORE', notes: '' });
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to add unit');
    }
  };

  return (
    <div className="space-y-4">
      {/* Fleet by type */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => {
          const list = units.filter((u) => u.unitType === type);
          const by = (s: UnitDisplayStatus) => list.filter((u) => unitDisplayStatus(u) === s).length;
          const segments = [
            { n: by('ON_HIRE'), c: 'bg-sky-500', label: 'on hire' },
            { n: by('AVAILABLE'), c: 'bg-emerald-500', label: 'free' },
            { n: by('MAINTENANCE'), c: 'bg-amber-500', label: 'service' },
            { n: by('BREAKDOWN'), c: 'bg-red-500', label: 'breakdown' },
          ];
          const Icon = UNIT_TYPE_ICON[type];
          const active = typeFilter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(active ? 'all' : type)}
              aria-pressed={active}
              className={cn(
                'group rounded-xl border bg-white p-4 text-left shadow-[var(--shadow-xs)] transition-all outline-none hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40',
                active ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/15'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn('flex size-10 items-center justify-center rounded-xl', TYPE_TINT[type])}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{UNIT_TYPE_LABELS[type]}s</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-emerald-700">{by('AVAILABLE')} free</span> of {list.length}
                  </div>
                </div>
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
                    Filtered <X className="size-3" />
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">Show only</span>
                )}
              </div>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
                {segments
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <div key={s.label} className={cn('rounded-full', s.c)} style={{ flexGrow: s.n }} />
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {segments
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <span key={s.label} className="inline-flex items-center gap-1">
                      <span className={cn('size-1.5 rounded-full', s.c)} />
                      {s.n} {s.label}
                    </span>
                  ))}
              </div>
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)]">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Unit, customer, chassis no. or note" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
            </div>
            <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <SegmentedControl
                size="sm"
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel="Status"
                options={[
                  { value: 'all', label: 'All', count: inType.length },
                  { value: 'AVAILABLE', label: 'Available', count: count('AVAILABLE') },
                  { value: 'ON_HIRE', label: 'On hire', count: count('ON_HIRE') },
                  { value: 'MAINTENANCE', label: 'Maintenance', count: count('MAINTENANCE') },
                  { value: 'BREAKDOWN', label: 'Breakdown', count: count('BREAKDOWN') },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedControl
              size="sm"
              value={layout}
              onChange={setLayout}
              ariaLabel="Layout"
              options={[
                { value: 'table', label: <span className="sr-only">Table</span>, icon: <List className="size-3.5" /> },
                { value: 'grid', label: <span className="sr-only">Cards</span>, icon: <LayoutGrid className="size-3.5" /> },
              ]}
            />
            <Button onClick={() => setShowAddUnit(true)} className="h-9 gap-1.5 px-3.5 hover:bg-[var(--brand-red-dark)]">
              <Plus /> Add unit
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No units found"
            description="Try a different search or filter."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : layout === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Availability</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Next service</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Use, last 90 days</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => (
                  <tr key={u.id} onClick={() => router.push(`/units/${u.id}`)} className="group cursor-pointer transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb unit={u} className="size-11" />
                        <div className="min-w-0">
                          <div className="font-mono-unit text-[13px] text-foreground">{u.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {UNIT_TYPE_LABELS[u.unitType]} · {UNIT_SIZE_LABELS[u.size]}
                            {u.specifications?.cubicCapacity ? ` · ${u.specifications.cubicCapacity} m³` : ''}
                          </div>
                          <div className="mt-1.5 md:hidden">
                            <Availability unit={u} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={unitDisplayStatus(u)} />
                    </td>
                    <td className="hidden max-w-[260px] px-4 py-3 md:table-cell">
                      <Availability unit={u} />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <ServiceDue date={u.serviceDue} />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Utilisation value={u.utilisation90} />
                    </td>
                    <td className="pr-4 text-right">
                      <span className="inline-flex items-center gap-1">
                        {!outOfAction(u) && (
                          <Link
                            href={`/bookings/new?unit=${encodeURIComponent(u.id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-2.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
                          >
                            <CalendarPlus className="size-3.5" /> Book
                          </Link>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((u) => (
              <article key={u.id} className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                <Link href={`/units/${u.id}`} className="relative block">
                  <Thumb unit={u} className="aspect-[16/9] w-full rounded-none border-0" iconClass="size-10" />
                  <span className="absolute top-3 left-3">
                    <StatusBadge status={unitDisplayStatus(u)} className="bg-white/95 shadow-[var(--shadow-xs)]" />
                  </span>
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <Link href={`/units/${u.id}`} className="min-w-0">
                    <div className="font-mono-unit text-base text-foreground group-hover:underline">{u.id}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {UNIT_TYPE_LABELS[u.unitType]} · {UNIT_SIZE_LABELS[u.size]}
                      {u.specifications?.cubicCapacity ? ` · ${u.specifications.cubicCapacity} m³` : ''}
                    </div>
                  </Link>
                  <Availability unit={u} />
                  <div className="mt-auto grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                    <div>
                      <div className="mb-0.5 text-[11px] text-muted-foreground">Next service</div>
                      <ServiceDue date={u.serviceDue} />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-muted-foreground">Use, 90 days</div>
                      <Utilisation value={u.utilisation90} />
                    </div>
                  </div>
                  {!outOfAction(u) && (
                    <Link href={`/bookings/new?unit=${encodeURIComponent(u.id)}`} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium hover:bg-muted">
                      <CalendarPlus className="size-3.5" /> Book {u.id}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Showing {filtered.length} of {units.length} units
        </div>
      </section>

      <Dialog open={showAddUnit} onOpenChange={setShowAddUnit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add unit to fleet</DialogTitle>
            <DialogDescription>New units are created as available. Add specifications from the unit page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Unit ID" required hint="Use the fleet prefix, e.g. CS-06 or UF-03">
              <Input value={newUnit.id} onChange={(e) => setNewUnit((p) => ({ ...p, id: e.target.value.toUpperCase() }))} placeholder="CS-06" className="h-9 font-mono" />
            </Field>
            <Field label="Unit type">
              <select value={newUnit.unitType} onChange={(e) => setNewUnit((p) => ({ ...p, unitType: e.target.value as UnitType }))} className={selectClass}>
                {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                  <option key={t} value={t}>
                    {UNIT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Size">
              <select value={newUnit.size} onChange={(e) => setNewUnit((p) => ({ ...p, size: e.target.value as UnitSize }))} className={selectClass}>
                {(Object.keys(UNIT_SIZE_LABELS) as UnitSize[]).map((s) => (
                  <option key={s} value={s}>
                    {UNIT_SIZE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea value={newUnit.notes} onChange={(e) => setNewUnit((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" className={textareaClass} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUnit(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleAddUnit} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Add unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** First unit photo if there is one, otherwise a tinted tile with the unit-type icon. */
function Thumb({ unit, className, iconClass = 'size-5' }: { unit: UnitWithHire; className?: string; iconClass?: string }) {
  const photo = unit.specifications?.photoUrls?.[0];
  const Icon = UNIT_TYPE_ICON[unit.unitType];
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- served from the private uploads route
    return <img src={photo} alt={`${unit.id}`} loading="lazy" className={cn('shrink-0 rounded-lg border object-cover', className)} />;
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-lg border', TYPE_TINT[unit.unitType], className)}>
      <Icon className={iconClass} />
    </span>
  );
}

function Availability({ unit }: { unit: UnitWithHire }) {
  if (unit.currentHire) {
    const { startDate, endDate, customerName } = unit.currentHire;
    const d = daysFromToday(endDate);
    const total = daysBetween(startDate, endDate);
    const elapsed = Math.min(total, Math.max(0, total - Math.max(0, d)));
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{customerName}</div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', d < 0 ? 'bg-red-500' : 'bg-sky-500')} style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
        <div className={cn('mt-1 text-xs', d < 0 ? 'font-medium text-red-600' : 'text-muted-foreground')}>
          {d < 0 ? `Collection overdue by ${-d}d` : d === 0 ? 'Back today' : `Back ${formatDate(endDate)} · ${d} day${d > 1 ? 's' : ''} left`}
        </div>
      </div>
    );
  }
  if (unit.breakdown)
    return (
      <span className="flex items-start gap-1.5 text-xs font-medium text-red-600">
        <TriangleAlert className="mt-px size-3.5 shrink-0" /> {unit.breakdown.notes || 'Broken down'}
      </span>
    );
  if (unit.status === 'MAINTENANCE')
    return (
      <span className="flex items-start gap-1.5 text-xs text-amber-700">
        <Wrench className="mt-px size-3.5 shrink-0" /> {unit.notes || 'In maintenance'}
      </span>
    );
  if (unit.nextBooking) {
    return (
      <div className="min-w-0">
        <div className="text-sm text-foreground">Free until {formatDate(unit.nextBooking.startDate)}</div>
        <div className="truncate text-xs text-muted-foreground">Next: {unit.nextBooking.customerName}</div>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <span className="size-1.5 rounded-full bg-emerald-500" /> Free, no bookings
    </span>
  );
}

function ServiceDue({ date }: { date?: string }) {
  if (!date) return <span className="text-xs text-muted-foreground">Not scheduled</span>;
  const d = daysFromToday(date);
  return (
    <span className={cn('tabular text-xs', d < 0 ? 'font-medium text-red-600' : d <= 14 ? 'font-medium text-amber-700' : 'text-foreground')}>
      {formatDate(date)}
      <span className="block text-[11px] font-normal text-muted-foreground">{d < 0 ? `${-d} days overdue` : d === 0 ? 'Due today' : `in ${d} days`}</span>
    </span>
  );
}

function Utilisation({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}
