import Link from 'next/link';
import { ArrowUpRight, PieChart } from 'lucide-react';
import { FleetDonut, type DonutSlice } from './fleet-donut';

/** Fleet Overview: donut of units by status with counts, percentages and a link to the fleet page. */
export function FleetOverviewCard({ slices, total }: { slices: DonutSlice[]; total: number }) {
  return (
    <section data-motion className="flex flex-col rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-[var(--brand-red)] ring-1 ring-red-600/15 ring-inset">
            <PieChart className="size-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Fleet overview</h2>
        </div>
        <Link href="/units" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          View fleet <ArrowUpRight className="size-3.5" />
        </Link>
      </header>
      <div className="flex flex-1 flex-col items-center gap-6 px-5 py-6 sm:flex-row sm:justify-center sm:gap-8">
        <FleetDonut slices={slices} total={total} />
        <ul className="w-full max-w-56 space-y-2.5">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-foreground">{s.label}</span>
              <span className="tabular font-semibold text-foreground">{s.value}</span>
              <span className="tabular w-10 text-right text-xs text-muted-foreground">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
