'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, type Tone } from '@/lib/domain';

export interface DrilldownItem {
  key: string;
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
}

export interface DrilldownCard {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  emphasis?: boolean;
  hint?: React.ReactNode;
  items: DrilldownItem[];
  emptyText?: string;
}

/**
 * Row of KPI boxes. A box with exactly one item opens it; with several it expands a list
 * underneath so the user can pick the record.
 */
export function KpiDrilldown({ cards }: { cards: DrilldownCard[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const active = cards.find((c) => c.key === open);

  const onClick = (card: DrilldownCard) => {
    if (card.items.length === 1) router.push(card.items[0].href);
    else setOpen((o) => (o === card.key ? null : card.key));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map((card) => {
          const t = TONE_CLASSES[card.tone ?? 'neutral'];
          const isOpen = open === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onClick(card)}
              aria-expanded={card.items.length === 1 ? undefined : isOpen}
              className={cn(
                'surface group relative block p-4 text-left transition-shadow outline-none hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40',
                isOpen && 'ring-2 ring-foreground/15'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-muted-foreground">{card.label}</span>
                <span className={cn('flex size-7 items-center justify-center rounded-md', t.soft)}>
                  <card.icon className={cn('size-4', t.text)} />
                </span>
              </div>
              <div className={cn('tabular mt-3 text-3xl font-semibold tracking-tight', card.emphasis ? t.text : 'text-foreground')}>{card.items.length}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{card.hint ?? (card.items.length === 1 ? 'Click to open' : card.items.length ? 'Click to see list' : '\u00a0')}</span>
                {card.items.length === 1 ? (
                  <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                ) : (
                  <ChevronDown className={cn('size-4 shrink-0 transition-transform', isOpen ? 'rotate-180' : 'opacity-0 group-hover:opacity-100')} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <section className="surface overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">
              {active.label} <span className="tabular ml-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{active.items.length}</span>
            </h2>
            <button type="button" onClick={() => setOpen(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close list">
              <X className="size-4" />
            </button>
          </header>
          {active.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{active.emptyText ?? 'Nothing here right now'}</p>
          ) : (
            <ul className="scrollbar-thin max-h-80 divide-y overflow-y-auto">
              {active.items.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{item.title}</div>
                      {item.subtitle && <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>}
                    </div>
                    {item.meta && <div className="shrink-0 text-xs text-muted-foreground">{item.meta}</div>}
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
