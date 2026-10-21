'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/app/empty-state';
import { BellOff, CircleAlert, PackageCheck, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatRelativeDay } from '@/lib/format';
import type { AppNotification } from '@/types';

const KIND_META: Record<AppNotification['kind'], { icon: typeof CircleAlert; className: string; label: string }> = {
  ACTION_OVERDUE: { icon: CircleAlert, className: 'bg-red-50 text-red-600', label: 'Action overdue' },
  COLLECTION_OVERDUE: { icon: PackageCheck, className: 'bg-amber-50 text-amber-700', label: 'Collection' },
  SERVICE_DUE: { icon: Wrench, className: 'bg-stone-100 text-stone-600', label: 'Service' },
};

export function NotificationsPanel({
  open,
  onOpenChange,
  notifications,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotification[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base font-semibold">Needs attention</SheetTitle>
          <SheetDescription>
            {notifications.length === 0 ? 'You’re all caught up.' : `${notifications.length} items need follow-up`}
          </SheetDescription>
        </SheetHeader>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState icon={BellOff} title="No open alerts" description="Overdue actions, collections and service reminders will appear here." />
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const meta = KIND_META[n.kind];
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => onOpenChange(false)}
                      className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/60"
                    >
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.className)}>
                        <meta.icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          <span className="shrink-0 text-xs text-muted-foreground" title={formatDate(n.date, { year: true })}>
                            {formatRelativeDay(n.date)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.description}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
