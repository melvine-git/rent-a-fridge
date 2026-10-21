import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Two-column label/value list used on detail pages. */
export function DetailList({ children, className, cols = 1 }: { children: React.ReactNode; className?: string; cols?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 p-4', cols === 2 && 'sm:grid-cols-2', className)}>{children}</dl>
  );
}

export function DetailItem({
  label,
  children,
  className,
  full,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  full?: boolean;
}) {
  return (
    <div className={cn('min-w-0', full && 'sm:col-span-2', className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children ?? '—'}</dd>
    </div>
  );
}

/** Horizontal strip of headline facts directly under the page header. */
export function StatStrip({ items }: { items: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border bg-border shadow-[var(--shadow-xs)] lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 bg-card px-4 py-3.5">
          <div className="text-xs font-medium text-muted-foreground">{it.label}</div>
          <div className="mt-1 truncate text-base font-semibold text-foreground">{it.value}</div>
          {it.sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export type TimelineStep = { label: string; detail?: React.ReactNode; state: 'done' | 'current' | 'upcoming' };

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="p-4">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span className={cn('absolute top-6 left-[11px] h-[calc(100%-20px)] w-px', s.state === 'done' ? 'bg-emerald-500' : 'bg-border')} />
          )}
          <span
            className={cn(
              'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-white',
              s.state === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
              s.state === 'current' && 'border-[var(--brand-red)]',
              s.state === 'upcoming' && 'border-border'
            )}
          >
            {s.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : s.state === 'current' ? <span className="size-2 rounded-full bg-[var(--brand-red)]" /> : null}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className={cn('text-sm font-medium', s.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>{s.label}</div>
            {s.detail && <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
