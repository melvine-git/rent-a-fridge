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
import { UnitTypeIcon, UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import { Plus, Search, LayoutGrid, List, PackageSearch, ChevronRight, Zap, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { addUnit } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { POWER_LABELS, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysFromToday, formatDate } from '@/lib/format';
import type { UnitStatus, UnitType, UnitSize, PowerType, UnitWithHire } from '@/types';

interface UnitsViewProps {
  units: UnitWithHire[];
}

export function UnitsView({ units }: UnitsViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | UnitStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'table' | 'grid'>('table');
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({
    id: '',
    size: 'MEDIUM' as UnitSize,
    powerType: 'STANDARD' as PowerType,
    unitType: 'COLD_STORE' as UnitType,
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter(
      (u) =>
        (statusFilter === 'all' || u.status === statusFilter) &&
        (typeFilter === 'all' || u.unitType === typeFilter) &&
        (!q || u.id.toLowerCase().includes(q) || u.currentHire?.customerName.toLowerCase().includes(q) || u.notes?.toLowerCase().includes(q))
    );
  }, [units, statusFilter, typeFilter, query]);

  const counts = {
    all: units.length,
    AVAILABLE: units.filter((u) => u.status === 'AVAILABLE').length,
    ON_HIRE: units.filter((u) => u.status === 'ON_HIRE').length,
    MAINTENANCE: units.filter((u) => u.status === 'MAINTENANCE').length,
  };

  const handleAddUnit = async () => {
    if (!newUnit.id) {
      toast.error('Please enter a unit ID');
      return;
    }
    const result = await addUnit(newUnit);
    if (result.success) {
      toast.success(`Unit ${newUnit.id} added to fleet`);
      setShowAddUnit(false);
      setNewUnit({ id: '', size: 'MEDIUM', powerType: 'STANDARD', unitType: 'COLD_STORE', notes: '' });
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to add unit');
    }
  };

  return (
    <div className="space-y-4">
      <section className="surface overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search unit or customer" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
            </div>
            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Status"
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'AVAILABLE', label: 'Available', count: counts.AVAILABLE },
                { value: 'ON_HIRE', label: 'On hire', count: counts.ON_HIRE },
                { value: 'MAINTENANCE', label: 'Maintenance', count: counts.MAINTENANCE },
              ]}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className={cn(selectClass, 'h-8 w-auto text-[13px]')}
              aria-label="Unit type"
            >
              <option value="all">All types</option>
              {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedControl
              size="sm"
              value={layout}
              onChange={setLayout}
              ariaLabel="Layout"
              options={[
                { value: 'table', label: <span className="sr-only">Table</span>, icon: <List className="size-3.5" /> },
                { value: 'grid', label: <span className="sr-only">Grid</span>, icon: <LayoutGrid className="size-3.5" /> },
              ]}
            />
            <Button onClick={() => setShowAddUnit(true)} className="h-9 gap-1.5 px-3.5 hover:bg-[var(--brand-red-dark)]">
              <Plus /> Add unit
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No units found" description="Try a different search or filter." />
        ) : layout === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Specification</th>
                  <th className="px-4 py-2.5 font-medium">Current / next hire</th>
                  <th className="hidden px-4 py-2.5 font-medium xl:table-cell">Notes</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => (
                  <tr key={u.id} onClick={() => router.push(`/units/${u.id}`)} className="group cursor-pointer hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UnitTypeIcon type={u.unitType} boxed />
                        <div>
                          <div className="font-mono-unit text-[13px] text-foreground">{u.id}</div>
                          <div className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[u.unitType]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                      {UNIT_SIZE_LABELS[u.size]} <span className="text-muted-foreground/40">·</span> {POWER_LABELS[u.powerType]}
                    </td>
                    <td className="px-4 py-3">
                      <HireSummary unit={u} />
                    </td>
                    <td className="hidden max-w-[240px] truncate px-4 py-3 text-muted-foreground xl:table-cell">{u.notes || '—'}</td>
                    <td className="pr-4">
                      <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((u) => {
              const Icon = UNIT_TYPE_ICON[u.unitType];
              return (
                <Link
                  key={u.id}
                  href={`/units/${u.id}`}
                  className="group flex flex-col rounded-lg border bg-white shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-md border bg-muted/50">
                        <Icon className="size-5 text-foreground/70" />
                      </span>
                      <div>
                        <div className="font-mono-unit text-base text-foreground">{u.id}</div>
                        <div className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[u.unitType]}</div>
                      </div>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                  <div className="grid grid-cols-2 divide-x border-y text-xs">
                    <div className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground">
                      <Ruler className="size-3.5" /> {UNIT_SIZE_LABELS[u.size]}
                    </div>
                    <div className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground">
                      <Zap className="size-3.5" /> {POWER_LABELS[u.powerType]}
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <HireSummary unit={u} />
                    {u.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{u.notes}</p>}
                  </div>
                </Link>
              );
            })}
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
              <Input
                value={newUnit.id}
                onChange={(e) => setNewUnit((p) => ({ ...p, id: e.target.value.toUpperCase() }))}
                placeholder="CS-06"
                className="h-9 font-mono"
              />
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Size">
                <select value={newUnit.size} onChange={(e) => setNewUnit((p) => ({ ...p, size: e.target.value as UnitSize }))} className={selectClass}>
                  {(Object.keys(UNIT_SIZE_LABELS) as UnitSize[]).map((s) => (
                    <option key={s} value={s}>
                      {UNIT_SIZE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Power">
                <select value={newUnit.powerType} onChange={(e) => setNewUnit((p) => ({ ...p, powerType: e.target.value as PowerType }))} className={selectClass}>
                  {(Object.keys(POWER_LABELS) as PowerType[]).map((p) => (
                    <option key={p} value={p}>
                      {POWER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={newUnit.notes}
                onChange={(e) => setNewUnit((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
                className={textareaClass}
              />
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

function HireSummary({ unit }: { unit: UnitWithHire }) {
  if (unit.currentHire) {
    const d = daysFromToday(unit.currentHire.endDate);
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{unit.currentHire.customerName}</div>
        <div className={cn('text-xs', d < 0 ? 'font-medium text-red-600' : 'text-muted-foreground')}>
          {d < 0 ? `Collection overdue by ${-d}d` : d === 0 ? 'Collection due today' : `Returns ${formatDate(unit.currentHire.endDate)}`}
        </div>
      </div>
    );
  }
  if (unit.status === 'MAINTENANCE') return <span className="text-xs text-muted-foreground">Unavailable while in service</span>;
  if (unit.nextBooking) {
    return (
      <div className="min-w-0">
        <div className="text-sm text-foreground">Free until {formatDate(unit.nextBooking.startDate)}</div>
        <div className="truncate text-xs text-muted-foreground">Next: {unit.nextBooking.customerName}</div>
      </div>
    );
  }
  return <span className="text-sm text-emerald-700">Ready to hire</span>;
}
