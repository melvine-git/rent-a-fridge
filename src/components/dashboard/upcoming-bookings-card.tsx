import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarClock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import type { BookingStatus } from '@/types';

export interface UpcomingBookingRow {
  reference: string;
  customer: string;
  startDate: string;
  status: BookingStatus;
  late: boolean;
}

/** Card listing the next few upcoming bookings, one row per booking (multi-unit groups counted once). */
export function UpcomingBookingsCard({ rows }: { rows: UpcomingBookingRow[] }) {
  return (
    <section data-motion className="flex flex-col rounded-2xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-600/15 ring-inset">
            <CalendarClock className="size-4" strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Upcoming bookings</h2>
        </div>
        <Link href="/bookings" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          View all <ArrowUpRight className="size-3.5" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-muted-foreground">
          No upcoming bookings — new ones will appear here.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((b) => (
            <li key={b.reference}>
              <Link href={`/bookings/${b.reference}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:underline">{b.customer}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono-unit">{b.reference}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular">{formatDate(b.startDate)}</span>
                    {b.late && <span className="font-medium text-red-600">delivery late</span>}
                  </p>
                </div>
                <StatusBadge status={b.status} />
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
