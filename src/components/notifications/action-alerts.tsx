'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleAlert, Phone, X, ChevronDown, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daysFromToday, formatDate, formatPhone } from '@/lib/format';
import type { BookingWithDetails } from '@/types';

interface ActionAlertsProps {
  overdueBookings: BookingWithDetails[];
}

export function ActionAlerts({ overdueBookings }: ActionAlertsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);

  const visible = overdueBookings.filter((b) => !dismissedIds.has(b.id));
  if (visible.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-red-200 bg-white shadow-[var(--shadow-xs)]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 bg-red-50/70 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <CircleAlert className="size-4 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-red-900">
            {visible.length} booking{visible.length > 1 ? 's' : ''} need{visible.length === 1 ? 's' : ''} action
          </span>
          <span className="ml-2 hidden text-sm text-red-800/70 sm:inline">Action date has passed</span>
        </div>
        <ChevronDown className={cn('size-4 text-red-700 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <ul className="divide-y divide-red-100">
          {visible.map((b) => {
            const overdue = -daysFromToday(b.actionDate!);
            return (
              <li key={b.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{b.actionDescription || 'Follow-up required'}</span>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                      {overdue === 0 ? 'Due today' : `${overdue}d overdue`}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {b.customer.name} · <span className="font-mono-unit">{b.unit.id}</span> · due {formatDate(b.actionDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`tel:${b.contactPhone}`}
                    className="hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted sm:inline-flex"
                    title={formatPhone(b.contactPhone)}
                  >
                    <Phone className="size-3.5" /> Call
                  </a>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    Open <ArrowUpRight className="size-3.5" />
                  </Link>
                  <button
                    onClick={() => setDismissedIds((prev) => new Set([...prev, b.id]))}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
