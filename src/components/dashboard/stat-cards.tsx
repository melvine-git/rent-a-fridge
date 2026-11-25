import Link from 'next/link';
import { Boxes, TriangleAlert, Wrench, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FleetStats {
  total: number;
  onHire: number;
  maintenance: number;
  brokenDown: number;
}

const CARDS = [
  { key: 'total', label: 'Total units', sub: 'Fleet size', icon: Boxes, iconCls: 'bg-red-50 text-[var(--brand-red)] ring-red-600/15', accent: 'text-foreground' },
  { key: 'onHire', label: 'On hire', sub: 'Out with customers', icon: KeyRound, iconCls: 'bg-blue-50 text-blue-600 ring-blue-600/15', accent: 'text-blue-700' },
  { key: 'maintenance', label: 'Under maintenance', sub: 'Being serviced', icon: Wrench, iconCls: 'bg-amber-50 text-amber-600 ring-amber-600/15', accent: 'text-amber-700' },
  { key: 'brokenDown', label: 'Broken down', sub: 'Needs attention', icon: TriangleAlert, iconCls: 'bg-stone-100 text-stone-700 ring-stone-600/15', accent: 'text-stone-800' },
] as const;

/** Four fleet statistics cards with status-colored icons and large tabular counts. */
export function StatCards({ stats }: { stats: FleetStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {CARDS.map((c) => (
        <Link
          key={c.key}
          href="/units"
          data-motion
          className="hover-lift group rounded-2xl border bg-white p-4 shadow-[var(--shadow-xs)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={cn('flex size-9 items-center justify-center rounded-lg ring-1 ring-inset', c.iconCls)}>
              <c.icon className="size-4.5" strokeWidth={2.2} />
            </span>
          </div>
          <p className={cn('tabular mt-3 text-3xl font-bold tracking-tight sm:text-4xl', c.accent)}>{stats[c.key]}</p>
          <p className="mt-1 text-[13px] font-medium text-foreground">{c.label}</p>
          <p className="text-xs text-muted-foreground">{c.sub}</p>
        </Link>
      ))}
    </div>
  );
}
