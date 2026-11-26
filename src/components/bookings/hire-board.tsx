'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ArrowUpRight, KeyRound, Plus, RotateCcw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/app/empty-state';
import { UnitIllustration } from '@/components/fleet/unit-illustration';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { STATUS_META, UNIT_TYPE_LABELS, type UnitDisplayStatus } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UnitType } from '@/types';

export interface HireBoardRow {
  id: string;
  unitType: UnitType;
  status: UnitDisplayStatus;
  hire?: {
    reference: string;
    customerName: string;
    startDate: string;
    endDate: string;
    site: string;
  };
}

type StatusFilter = 'all' | UnitDisplayStatus;
const UNIT_TYPES: UnitType[] = ['COLD_STORE', 'UPRIGHT_FRIDGE', 'CHEST_FREEZER', 'STATIC'];

const DOT: Record<UnitDisplayStatus, string> = {
  AVAILABLE: 'bg-emerald-500',
  ON_HIRE: 'bg-blue-500',
  MAINTENANCE: 'bg-amber-500',
  BREAKDOWN: 'bg-red-500',
};

/** Unit-centric hire board: status + type filters, search, and cards linking to each unit's page. */
export function HireBoard({ rows }: { rows: HireBoardRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('ON_HIRE');
  const [types, setTypes] = useState<UnitType[]>([]);
  const [query, setQuery] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: rows.length, ON_HIRE: 0, AVAILABLE: 0, MAINTENANCE: 0, BREAKDOWN: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (types.length && !types.includes(r.unitType)) return false;
      if (!q) return true;
      return [r.id, r.hire?.customerName, r.hire?.site, r.hire?.reference].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [rows, status, types, query]);

  const filtersActive = status !== 'ON_HIRE' || types.length > 0 || query.trim() !== '';
  const reset = () => {
    setStatus('ON_HIRE');
    setTypes([]);
    setQuery('');
  };

  // Gentle stagger when the visible set changes; skipped under reduced motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = gridRef.current?.querySelectorAll('[data-card]');
    if (!cards?.length) return;
    const tween = gsap.fromTo(cards, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04, clearProps: 'opacity,transform' });
    return () => {
      tween.kill();
    };
  }, [status, types, query]);

  const pills: { value: StatusFilter; label: string }[] = [
    { value: 'ON_HIRE', label: 'On hire' },
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'MAINTENANCE', label: 'In maintenance' },
    { value: 'BREAKDOWN', label: 'Broken down' },
    { value: 'all', label: 'All units' },
  ];

  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setStatus(p.value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
                status === p.value ? 'bg-stone-900 text-white' : 'border bg-white text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {p.label}
              <span className={cn('tabular rounded-full px-1.5 text-[11px] font-semibold', status === p.value ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground')}>{counts[p.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {UNIT_TYPES.map((t) => {
            const active = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypes((s) => (active ? s.filter((x) => x !== t) : [...s, t]))}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors',
                  active ? 'border-stone-900 bg-stone-900 text-white' : 'bg-white text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <UnitTypeIcon type={t} className="size-3.5" />
                {UNIT_TYPE_LABELS[t]}
              </button>
            );
          })}
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Unit, customer or site" className="h-8 w-44 bg-white pl-8 text-[13px]" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {filtersActive && (
            <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        status === 'ON_HIRE' && !filtersActive ? (
          <div className="rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
            <EmptyState
              icon={KeyRound}
              title="No active hires right now"
              description="There's no equipment currently out on hire. When a booking moves into the on-hire stage, it will appear here."
              action={
                <Link
                  href="/bookings/new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-3 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--brand-red-dark)]"
                >
                  <Plus className="size-4" /> New booking
                </Link>
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
            <EmptyState icon={Search} title="No units match these filters" description="Try a different status, type or search — or reset the filters." />
          </div>
        )
      ) : (
        <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <Link key={u.id} href={`/units/${u.id}`} data-card className="hover-lift group flex flex-col rounded-2xl border bg-white p-4 shadow-[var(--shadow-xs)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-200/80 ring-inset">
                    <UnitIllustration type={u.unitType} className="p-1" />
                  </span>
                  <div>
                    <p className="font-mono-unit text-[15px] text-foreground group-hover:underline">{u.id}</p>
                    <p className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[u.unitType]}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', DOT[u.status])} aria-hidden />
                  {STATUS_META[u.status].label}
                </span>
              </div>

              {u.hire ? (
                <dl className="mt-3.5 space-y-1.5 border-t pt-3 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="truncate font-medium text-foreground">{u.hire.customerName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Hire period</dt>
                    <dd className="tabular text-foreground">
                      {formatDate(u.hire.startDate)} – {formatDate(u.hire.endDate)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Site</dt>
                    <dd className="truncate text-foreground">{u.hire.site}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Booking</dt>
                    <dd>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/bookings/${u.hire!.reference}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/bookings/${u.hire!.reference}`);
                          }
                        }}
                        className="font-mono-unit inline-flex cursor-pointer items-center gap-1 text-xs text-(--brand-red) hover:underline"
                      >
                        {u.hire.reference} <ArrowUpRight className="size-3" />
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3.5 border-t pt-3 text-[13px] text-muted-foreground">
                  {u.status === 'AVAILABLE' ? 'In the yard, ready for hire' : u.status === 'MAINTENANCE' ? 'Being serviced — not available' : 'Out of action'}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
