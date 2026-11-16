'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/app/empty-state';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UNIT_TYPE_ICON } from '@/components/app/unit-type-icon';
import { HeroScene } from '@/components/dispatch/hero-scene';
import { UnitIllustration } from '@/components/fleet/unit-illustration';
import {
  BarChart3,
  Box,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  History,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  PackageSearch,
  Play,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  User,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { addUnit } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, unitDisplayStatus, type UnitDisplayStatus } from '@/lib/domain';
import { daysBetween, daysFromToday, formatDate } from '@/lib/format';
import type { UnitType, UnitSize, UnitWithHire } from '@/types';

interface UnitsViewProps {
  units: UnitWithHire[];
}

type Filter = 'all' | 'AVAILABLE' | 'ON_HIRE' | 'MAINTENANCE' | 'ISSUES';

const TYPE_TINT: Record<UnitType, string> = {
  COLD_STORE: 'bg-red-50 text-[var(--brand-red)]',
  UPRIGHT_FRIDGE: 'bg-emerald-50 text-emerald-700',
  CHEST_FREEZER: 'bg-stone-100 text-stone-600',
};

const STATUS_PILL: Record<UnitDisplayStatus, { label: string; icon: LucideIcon; cls: string }> = {
  AVAILABLE: { label: 'Available', icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ON_HIRE: { label: 'On hire', icon: Play, cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  BREAKDOWN: { label: 'Breakdown', icon: TriangleAlert, cls: 'bg-red-50 text-red-700 ring-red-200' },
};

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

const outOfAction = (u: UnitWithHire) => !!u.breakdown || u.status === 'MAINTENANCE';
const overdueDays = (u: UnitWithHire) => (u.currentHire ? Math.max(0, -daysFromToday(u.currentHire.endDate)) : 0);
const serviceOverdue = (u: UnitWithHire) => (u.serviceDue ? Math.max(0, -daysFromToday(u.serviceDue)) : 0);
const hasIssue = (u: UnitWithHire) => !!u.breakdown || overdueDays(u) > 0 || serviceOverdue(u) > 0;

function capacity(u: UnitWithHire) {
  const c = u.specifications?.cubicCapacity;
  if (!c) return undefined;
  return c < 1 ? `${Math.round(c * 1000)} L` : `${c} m³`;
}
function dimensions(u: UnitWithHire) {
  const d = u.specifications?.externalDimensions;
  if (!d) return undefined;
  const m = (mm: number) => (mm / 1000).toFixed(1);
  return `${m(d.length)} × ${m(d.width)} × ${m(d.height)} m`;
}

export function UnitsView({ units }: UnitsViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'gallery' | 'table'>('gallery');
  const [selectedId, setSelectedId] = useState<string | null>(() => units.find(hasIssue)?.id ?? units[0]?.id ?? null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ id: '', size: 'MEDIUM' as UnitSize, unitType: 'COLD_STORE' as UnitType, notes: '' });

  const inType = typeFilter === 'all' ? units : units.filter((u) => u.unitType === typeFilter);
  const matches = (u: UnitWithHire, f: Filter) =>
    f === 'all' || (f === 'ISSUES' ? hasIssue(u) : f === 'MAINTENANCE' ? u.status === 'MAINTENANCE' && !u.breakdown : unitDisplayStatus(u) === f);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const typeOrder = Object.keys(UNIT_TYPE_LABELS) as UnitType[];
    return inType.filter(
      (u) =>
        matches(u, filter) &&
        (!q ||
          u.id.toLowerCase().includes(q) ||
          UNIT_TYPE_LABELS[u.unitType].toLowerCase().includes(q) ||
          u.currentHire?.customerName.toLowerCase().includes(q) ||
          u.currentHire?.site.toLowerCase().includes(q) ||
          u.nextBooking?.customerName.toLowerCase().includes(q) ||
          u.notes?.toLowerCase().includes(q) ||
          u.specifications?.chassisNumber?.toLowerCase().includes(q))
    ).sort((a, b) => typeOrder.indexOf(a.unitType) - typeOrder.indexOf(b.unitType) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [inType, filter, query]);
  const selected = units.find((u) => u.id === selectedId) ?? null;
  const types = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).filter((t) => units.some((u) => u.unitType === t));

  const select = (u: UnitWithHire) => {
    // The side panel only shows on wide screens; elsewhere go straight to the unit
    if (!window.matchMedia('(min-width: 1280px)').matches) router.push(`/units/${u.id}`);
    else setSelectedId(u.id);
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
      setNewUnit({ id: '', size: 'MEDIUM', unitType: 'COLD_STORE', notes: '' });
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to add unit');
    }
  };

  const chips: { key: Filter; label: string; icon: LucideIcon; cls: string; active: string }[] = [
    { key: 'all', label: 'All units', icon: SlidersHorizontal, cls: 'bg-white text-foreground ring-stone-200', active: 'bg-stone-900 text-white ring-stone-900' },
    { key: 'AVAILABLE', label: 'Available', icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', active: 'bg-emerald-600 text-white ring-emerald-600' },
    { key: 'ON_HIRE', label: 'On hire', icon: Play, cls: 'bg-blue-50 text-blue-700 ring-blue-200', active: 'bg-blue-600 text-white ring-blue-600' },
    { key: 'MAINTENANCE', label: 'Maintenance', icon: Wrench, cls: 'bg-amber-50 text-amber-800 ring-amber-200', active: 'bg-amber-500 text-white ring-amber-500' },
    { key: 'ISSUES', label: 'Issues', icon: CircleAlert, cls: 'bg-red-50 text-red-700 ring-red-200', active: 'bg-red-600 text-white ring-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero: title and the three equipment categories over the mountain scene */}
      <section className="relative -mx-4 -mt-6 px-4 pt-8 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <HeroScene image="/fleet/hero-mountains.jpg" layout="full" />
        <div className="relative">
          <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] text-foreground [text-shadow:0_0_16px_rgb(255_255_255/0.9)] sm:text-[40px]">Fleet</h1>
          <p className="mt-1 text-[15px] text-foreground/70 [text-shadow:0_0_12px_rgb(255_255_255/0.95),0_0_4px_rgb(255_255_255/0.9)]">
            {units.length} units across {NUMBER_WORDS[types.length] ?? types.length} equipment {types.length === 1 ? 'category' : 'categories'}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {types.map((t) => {
              const list = units.filter((u) => u.unitType === t);
              const free = list.filter((u) => unitDisplayStatus(u) === 'AVAILABLE').length;
              const active = typeFilter === t;
              const Icon = UNIT_TYPE_ICON[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(active ? 'all' : t)}
                  aria-pressed={active}
                  className={cn(
                    'group flex items-center gap-4 rounded-2xl border border-white/70 bg-white/85 p-3 pr-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-14px_rgb(0_0_0/0.2)] backdrop-blur transition-all outline-none hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/40',
                    active && 'ring-2 ring-stone-900'
                  )}
                >
                  <span className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-white to-stone-100 lg:w-36">
                    <UnitIllustration type={t} className="transition-transform duration-300 group-hover:scale-105" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold text-foreground">{UNIT_TYPE_LABELS[t]}s</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className={cn('flex size-7 items-center justify-center rounded-lg', TYPE_TINT[t])}>
                          <Icon className="size-4" />
                        </span>
                        {active ? <X className="size-4 text-foreground" /> : <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                      </span>
                    </span>
                    <span className="tabular block text-[28px] leading-tight font-bold text-foreground">{list.length}</span>
                    <span className="block text-[13px] font-medium text-emerald-700">{free} available</span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-stone-200">
                      <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${list.length ? (free / list.length) * 100 : 0}%` }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className={cn('grid gap-4 lg:gap-6', selected && 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
        {/* Equipment */}
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
          <header className="flex flex-col gap-3 px-5 pt-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-semibold tracking-tight whitespace-nowrap text-foreground">
              Your equipment
              {typeFilter !== 'all' && (
                <button type="button" onClick={() => setTypeFilter('all')} className="ml-2 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 align-middle text-[11px] font-medium text-white">
                  {UNIT_TYPE_LABELS[typeFilter]}s <X className="size-3" />
                </button>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by unit, type or location..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 rounded-lg pl-9" />
              </div>
              <div className="flex rounded-lg border bg-white p-0.5">
                {(
                  [
                    ['gallery', 'Gallery', LayoutGrid],
                    ['table', 'Table', List],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLayout(v)}
                    className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors', layout === v ? 'bg-stone-900 text-white' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAddUnit(true)}
                title="Add unit"
                className="inline-flex size-9 items-center justify-center rounded-lg border bg-white text-foreground transition-colors hover:bg-muted"
              >
                <Plus className="size-4" />
                <span className="sr-only">Add unit</span>
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
            {chips.map((c) => {
              const on = filter === c.key;
              const n = inType.filter((u) => matches(u, c.key)).length;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors ring-inset', on ? c.active : cn(c.cls, 'hover:brightness-95'))}
                >
                  <c.icon className="size-3.5" />
                  {c.label}
                  <span className={cn('tabular rounded-full px-1.5 text-[11px] font-semibold', on ? 'bg-white/20' : 'bg-white/70')}>{n}</span>
                </button>
              );
            })}
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
                    setFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : layout === 'gallery' ? (
            <div className="grid grid-cols-2 gap-3 border-t bg-stone-50/50 p-3 sm:gap-4 sm:p-5 lg:grid-cols-3">
              {filtered.map((u) => (
                <EquipmentCard key={u.id} unit={u} selected={u.id === selected?.id} onSelect={() => select(u)} />
              ))}
            </div>
          ) : (
            <UnitsTable units={filtered} onOpen={(u) => router.push(`/units/${u.id}`)} />
          )}
          <div className="border-t bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {units.length} units
          </div>
        </section>

        {/* Selected unit */}
        {selected && <DetailPanel unit={selected} onClose={() => setSelectedId(null)} />}
      </div>

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

/** The unit's photo, or a drawing of its type. */
function UnitImage({ unit, className, fit = 'contain' }: { unit: UnitWithHire; className?: string; fit?: 'contain' | 'cover' }) {
  const photo = unit.specifications?.photoUrls?.[0];
  return (
    <div className={cn('overflow-hidden bg-white', className)}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- served from the private uploads route
        <img src={photo} alt={unit.id} loading="lazy" className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain p-2')} />
      ) : (
        <UnitIllustration type={unit.unitType} className="p-2" />
      )}
    </div>
  );
}

function StatusPill({ unit, className }: { unit: UnitWithHire; className?: string }) {
  const s = STATUS_PILL[unitDisplayStatus(unit)];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', s.cls, className)}>
      <s.icon className="size-3" /> {s.label}
    </span>
  );
}

function UtilBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
        <span className="block h-full rounded-full bg-stone-800" style={{ width: `${value}%` }} />
      </span>
      <span className="tabular w-8 text-right text-xs text-muted-foreground">{value}%</span>
    </span>
  );
}

function EquipmentCard({ unit: u, selected, onSelect }: { unit: UnitWithHire; selected: boolean; onSelect: () => void }) {
  const late = overdueDays(u);
  const service = serviceOverdue(u);
  const cap = capacity(u);
  const dims = dimensions(u);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all outline-none hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40',
        selected ? 'border-red-300 ring-2 ring-red-200' : 'hover:border-stone-300'
      )}
    >
      <div className="relative">
        <UnitImage unit={u} className="aspect-[16/10] w-full" />
        <StatusPill unit={u} className="absolute top-2.5 right-2.5 shadow-[var(--shadow-xs)]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <div className="text-[17px] leading-tight font-bold text-foreground">{u.id}</div>
          <div className="text-xs text-muted-foreground">
            {UNIT_TYPE_LABELS[u.unitType]} · {UNIT_SIZE_LABELS[u.size]}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Box className="size-3.5" /> {cap ?? 'Capacity —'}
          </span>
          {dims && <span className="tabular">{dims}</span>}
        </div>
        {late > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs leading-tight font-medium text-red-700">
            <TriangleAlert className="size-3.5 shrink-0" /> Collection overdue · {late} {late === 1 ? 'day' : 'days'}
          </p>
        )}
        {late === 0 && service > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
            <Wrench className="size-3.5 shrink-0" /> Service overdue · {service} {service === 1 ? 'day' : 'days'}
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="shrink-0"><span className="hidden sm:inline">Utilisation (90 days)</span><span className="sm:hidden">Use, 90d</span></span>
          <UtilBar value={u.utilisation90} className="flex-1" />
        </div>
      </div>
    </button>
  );
}

function DetailPanel({ unit: u, onClose }: { unit: UnitWithHire; onClose: () => void }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const status = unitDisplayStatus(u);
  const late = overdueDays(u);
  const cap = capacity(u);
  const hire = u.currentHire;
  const left = hire ? daysFromToday(hire.endDate) : 0;

  const second: { label: string; value: string; tone?: 'danger' | 'warning' } = u.breakdown
    ? { label: 'Breakdown', value: `Since ${formatDate(u.breakdown.reportedAt)}`, tone: 'danger' }
    : status === 'MAINTENANCE'
      ? { label: 'Status', value: 'In service', tone: 'warning' }
      : hire
        ? late > 0
          ? { label: 'Collection', value: `Overdue · ${late} ${late === 1 ? 'day' : 'days'}`, tone: 'danger' }
          : { label: 'Collection', value: left === 0 ? 'Due today' : `${formatDate(hire.endDate)} · in ${left}d` }
        : u.nextBooking
          ? { label: 'Next hire', value: formatDate(u.nextBooking.startDate) }
          : { label: 'Availability', value: 'Free to hire' };

  const location = hire ? `On hire · ${hire.site}` : status === 'MAINTENANCE' || u.breakdown ? 'Workshop / yard' : 'In the yard';
  const rows: { icon: LucideIcon; label: string; value: React.ReactNode }[] = [
    { icon: Ruler, label: 'Dimensions', value: dimensions(u) ?? '—' },
    { icon: Box, label: 'Capacity', value: cap ?? '—' },
    { icon: MapPin, label: 'Location', value: location },
    {
      icon: CalendarDays,
      label: 'Next service',
      value: u.serviceDue ? <span className={cn(serviceOverdue(u) > 0 && 'font-medium text-red-600')}>{formatDate(u.serviceDue)}</span> : 'Not scheduled',
    },
    { icon: BarChart3, label: 'Utilisation (90 days)', value: <UtilBar value={u.utilisation90} className="w-36" /> },
  ];

  return (
    <aside className="hidden h-fit flex-col overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-xs)] xl:sticky xl:top-20 xl:flex">
      <header className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-tight font-bold tracking-tight text-foreground">{u.id}</h2>
          <p className="text-xs text-muted-foreground">
            {UNIT_TYPE_LABELS[u.unitType]} · {UNIT_SIZE_LABELS[u.size]}
            {cap ? ` · ${cap}` : ''}
          </p>
        </div>
        <StatusPill unit={u} className="mt-1" />
        <button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-muted" aria-label="Close">
          <X className="size-4" />
        </button>
      </header>

      <div className="px-5 pt-4">
        <UnitImage unit={u} fit="cover" className="aspect-[16/10] w-full rounded-xl border" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        <div className="flex items-center gap-2.5 rounded-xl border bg-stone-50/60 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-muted-foreground ring-1 ring-stone-200">
            <User className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-muted-foreground">Customer</span>
            <span className="line-clamp-2 block text-[13px] leading-snug font-semibold text-foreground">{hire?.customerName ?? u.nextBooking?.customerName ?? "—"}</span>
          </span>
        </div>
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-3',
            second.tone === 'danger' ? 'border-red-100 bg-red-50' : second.tone === 'warning' ? 'border-amber-100 bg-amber-50' : 'bg-stone-50/60'
          )}
        >
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1', second.tone === 'danger' ? 'text-red-600 ring-red-200' : second.tone === 'warning' ? 'text-amber-700 ring-amber-200' : 'text-muted-foreground ring-stone-200')}>
            <CalendarDays className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-muted-foreground">{second.label}</span>
            <span className={cn('line-clamp-2 block text-[13px] leading-snug font-semibold', second.tone === 'danger' ? 'text-red-700' : second.tone === 'warning' ? 'text-amber-800' : 'text-foreground')}>{second.value}</span>
          </span>
        </div>
      </div>

      {(u.breakdown?.notes || (status === 'MAINTENANCE' && u.notes)) && (
        <p className={cn('mx-5 mt-3 rounded-lg px-3 py-2 text-xs', u.breakdown ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>{u.breakdown?.notes || u.notes}</p>
      )}

      <dl className="divide-y px-5 pt-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 py-2.5 text-[13px]">
            <r.icon className="size-4 shrink-0 text-muted-foreground" />
            <dt className="flex-1 text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 truncate text-right text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex items-center gap-2 border-t px-5 py-4">
        <Link href={`/units/${u.id}`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-red)] text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-red-dark)]">
          <Wrench className="size-4" /> Manage unit
        </Link>
        <Link href={`/units/${u.id}?tab=bookings`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">
          <History className="size-4" /> View history
        </Link>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="More actions" className="flex size-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted">
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <div className="absolute right-0 bottom-12 z-20 w-52 overflow-hidden rounded-xl border bg-white py-1 text-sm shadow-[var(--shadow-lg)]">
              {!outOfAction(u) && (
                <MenuLink href={`/bookings/new?unit=${encodeURIComponent(u.id)}`} icon={CalendarPlus}>
                  Book {u.id}
                </MenuLink>
              )}
              {hire && (
                <MenuLink href={`/bookings/${hire.reference}`} icon={CalendarDays}>
                  Open current booking
                </MenuLink>
              )}
              <MenuLink href={`/units/${u.id}?tab=maintenance`} icon={Wrench}>
                Service history
              </MenuLink>
              <MenuLink href={`/units/${u.id}?tab=bom`} icon={Box}>
                Components
              </MenuLink>
            </div>
          )}
        </div>
      </footer>
    </aside>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 text-foreground hover:bg-muted">
      <Icon className="size-4 text-muted-foreground" /> {children}
    </Link>
  );
}

function UnitsTable({ units, onOpen }: { units: UnitWithHire[]; onOpen: (u: UnitWithHire) => void }) {
  return (
    <div className="overflow-x-auto border-t">
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
          {units.map((u) => (
            <tr key={u.id} onClick={() => onOpen(u)} className="group cursor-pointer transition-colors hover:bg-muted/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <UnitImage unit={u} fit="cover" className="size-11 shrink-0 rounded-lg border" />
                  <div className="min-w-0">
                    <div className="font-mono-unit text-[13px] text-foreground">{u.id}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {UNIT_TYPE_LABELS[u.unitType]} · {UNIT_SIZE_LABELS[u.size]}
                      {capacity(u) ? ` · ${capacity(u)}` : ''}
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
                <UtilBar value={u.utilisation90} className="w-28" />
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
