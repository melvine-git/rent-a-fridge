'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { Bell, ChevronRight, Menu, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  deliveries: 'Deliveries',
  collections: 'Collections',
  customers: 'Customers',
  units: 'Units',
  maintenance: 'Maintenance',
  new: 'New booking',
};

interface TopBarProps {
  onMenuClick: () => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  notificationCount: number;
}

export function TopBar({ onMenuClick, onSearchClick, onNotificationsClick, notificationCount }: TopBarProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur supports-backdrop-filter:bg-white/75 sm:px-6">
      <button
        onClick={onMenuClick}
        className="-ml-1 flex size-9 items-center justify-center rounded-md text-foreground/70 hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        {segments.map((seg, i) => {
          const href = '/' + segments.slice(0, i + 1).join('/');
          const last = i === segments.length - 1;
          const label = SEGMENT_LABELS[seg] ?? decodeURIComponent(seg);
          return (
            <Fragment key={href}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
              {last ? (
                <span className={cn('truncate font-medium text-foreground', !SEGMENT_LABELS[seg] && 'font-mono-unit text-[13px]')}>
                  {label}
                </span>
              ) : (
                <Link href={href} className="truncate text-muted-foreground hover:text-foreground">
                  {label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onSearchClick}
          className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:w-72"
        >
          <Search className="size-4" />
          <span className="hidden md:inline">Search…</span>
          <kbd className="ml-auto hidden rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium md:inline">Ctrl K</kbd>
        </button>

        <button
          onClick={onNotificationsClick}
          className="relative flex size-9 items-center justify-center rounded-md border text-foreground/70 transition-colors hover:bg-muted"
          aria-label={`Notifications${notificationCount ? ` (${notificationCount})` : ''}`}
        >
          <Bell className="size-4" />
          {notificationCount > 0 && (
            <span className="tabular absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-red)] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {pathname !== '/bookings/new' && (
          <Link
            href="/bookings/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-3 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--brand-red-dark)]"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New booking</span>
          </Link>
        )}
      </div>
    </header>
  );
}
