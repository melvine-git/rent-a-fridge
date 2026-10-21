'use client';

import { cn } from '@/lib/utils';

interface TabBarProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  className?: string;
  trailing?: React.ReactNode;
}

/** Underline-style section tabs for pages and detail views. */
export function TabBar<T extends string>({ value, onChange, tabs, className, trailing }: TabBarProps<T>) {
  return (
    <div className={cn('flex items-center gap-4 border-b', className)}>
      <div role="tablist" className="scrollbar-thin -mb-px flex flex-1 gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn(
                'flex items-center gap-2 border-b-2 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:text-foreground',
                active ? 'border-[var(--brand-red)] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn('tabular rounded px-1.5 py-px text-xs', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 pb-2">{trailing}</div>}
    </div>
  );
}
