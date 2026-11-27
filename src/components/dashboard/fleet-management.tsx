'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight, Warehouse } from 'lucide-react';
import { UnitIllustration } from '@/components/fleet/unit-illustration';
import { STATUS_META, type UnitDisplayStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { UnitType } from '@/types';

export interface FleetRow {
  id: string;
  unitType: UnitType;
  status: UnitDisplayStatus;
  /** e.g. the hire site for units out, or nothing for units in the yard */
  location?: string;
}

type Tab = 'all' | 'ON_HIRE' | 'AVAILABLE';

const DOT: Record<UnitDisplayStatus, string> = {
  AVAILABLE: 'bg-emerald-500',
  ON_HIRE: 'bg-blue-500',
  MAINTENANCE: 'bg-amber-500',
  BREAKDOWN: 'bg-red-500',
};

const TYPE_LABEL: Record<UnitType, string> = {
  COLD_STORE: 'Cold store',
  UPRIGHT_FRIDGE: 'Upright fridge',
  CHEST_FREEZER: 'Chest freezer',
  STATIC: 'Static',
};

const ROW_LIMIT = 6;

/** Interactive fleet list with All / On hire / Available filters; statuses come from the shared unit display logic. */
export function FleetManagement({ rows }: { rows: FleetRow[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const listRef = useRef<HTMLUListElement>(null);

  const onHire = rows.filter((r) => r.status === 'ON_HIRE').length;
  const available = rows.filter((r) => r.status === 'AVAILABLE').length;
  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: 'All units', count: rows.length },
    { value: 'ON_HIRE', label: 'On hire', count: onHire },
    { value: 'AVAILABLE', label: 'Available', count: available },
  ];

  const filtered = rows.filter((r) => (tab === 'all' ? true : r.status === tab)).slice(0, ROW_LIMIT);

  // Subtle stagger when the filter changes; skipped under reduced motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = listRef.current?.querySelectorAll('li');
    if (!items?.length) return;
    const tween = gsap.fromTo(items, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', stagger: 0.035, clearProps: 'opacity,transform' });
    return () => {
      tween.kill();
    };
  }, [tab]);

  return (
    <section data-motion className="flex flex-col rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 ring-1 ring-stone-600/15 ring-inset">
            <Warehouse className="size-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Fleet management</h2>
        </div>
        <Link href="/units" className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-muted">
          View all <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b px-5 py-2.5">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3',
              tab === t.value ? 'bg-stone-900 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t.value === 'all' ? (
              <>
                <span className="sm:hidden">All</span>
                <span className="hidden sm:inline">All units</span>
              </>
            ) : (
              t.label
            )}
            <span className={cn('tabular rounded-full px-1.5 text-[11px] font-semibold', tab === t.value ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground')}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-muted-foreground">
          No units in this category right now.
        </p>
      ) : (
        <ul ref={listRef} className="divide-y">
          {filtered.map((u) => (
            <li key={u.id}>
              <Link href={`/units/${u.id}`} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40">
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-50 ring-1 ring-stone-200/80 ring-inset">
                  <UnitIllustration type={u.unitType} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground group-hover:underline">
                    <span className="font-mono-unit">{u.id}</span>
                    <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{TYPE_LABEL[u.unitType]}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.location ?? 'In yard'}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                  <span className={cn('size-2 rounded-full', DOT[u.status])} aria-hidden />
                  {STATUS_META[u.status].label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
