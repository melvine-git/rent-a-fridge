'use client';

import Link from 'next/link';
import { ArrowUpRight, BellRing, CircleAlert, OctagonAlert, PackageCheck, Wrench, type LucideIcon } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';
import { useMergedNotifications } from '@/components/notifications/notification-overrides';

const KIND_META: Record<AppNotification['kind'], { icon: LucideIcon; cls: string }> = {
  BREAKDOWN: { icon: OctagonAlert, cls: 'bg-red-50 text-red-600 ring-red-600/15' },
  SERVICE_DUE: { icon: Wrench, cls: 'bg-amber-50 text-amber-600 ring-amber-600/15' },
  COLLECTION_OVERDUE: { icon: PackageCheck, cls: 'bg-violet-50 text-violet-600 ring-violet-600/15' },
  ACTION_OVERDUE: { icon: CircleAlert, cls: 'bg-blue-50 text-blue-600 ring-blue-600/15' },
};

/**
 * Attention Required: actionable issues from the same derived notifications the
 * bell shows — no parallel alert system. "View alerts" opens the shell's panel.
 */
export function AttentionPanel({ items: rawItems }: { items: AppNotification[] }) {
  const items = useMergedNotifications(rawItems);
  return (
    <section data-motion className="flex flex-col rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-[var(--brand-red)] ring-1 ring-red-600/15 ring-inset">
            <BellRing className="size-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Attention required</h2>
          {items.length > 0 && (
            <span className="tabular rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-[var(--brand-red)] ring-1 ring-red-600/15 ring-inset">{items.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          View alerts <ArrowUpRight className="size-3.5" />
        </button>
      </header>
      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-muted-foreground">
          Nothing needs attention right now.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.ACTION_OVERDUE;
            return (
              <li key={n.id}>
                <Link href={n.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', meta.cls)}>
                    <meta.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:underline">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.description}
                      {n.description ? ' · ' : ''}
                      <span className="tabular">{formatDate(n.date)}</span>
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
