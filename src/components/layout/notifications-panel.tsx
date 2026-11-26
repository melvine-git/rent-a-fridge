'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/app/empty-state';
import { BellOff, CircleAlert, Mail, MailOpen, PackageCheck, TriangleAlert, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatRelativeDay } from '@/lib/format';
import { dismissNotification, setNotificationRead } from '@/lib/actions';
import { setNotificationOverride } from '@/components/notifications/notification-overrides';
import type { AppNotification } from '@/types';

const KIND_META: Record<AppNotification['kind'], { icon: typeof CircleAlert; className: string; label: string }> = {
  ACTION_OVERDUE: { icon: CircleAlert, className: 'bg-red-50 text-red-600', label: 'Action overdue' },
  COLLECTION_OVERDUE: { icon: PackageCheck, className: 'bg-amber-50 text-amber-700', label: 'Collection' },
  SERVICE_DUE: { icon: Wrench, className: 'bg-stone-100 text-stone-600', label: 'Service' },
  BREAKDOWN: { icon: TriangleAlert, className: 'bg-red-50 text-red-600', label: 'Breakdown' },
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
  const router = useRouter();

  const run = async (action: Promise<{ success: boolean; error?: string }>, fallback: string) => {
    const r = await action.catch(() => ({ success: false, error: 'Connection problem, please try again' }));
    if (r.success) router.refresh();
    else toast.error(fallback, { description: r.error ?? 'Please try again' });
  };

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
                  <li key={n.id} className="group flex items-stretch">
                    <Link
                      href={n.href}
                      onClick={() => onOpenChange(false)}
                      className={cn('flex min-w-0 flex-1 gap-3 px-5 py-4 transition-colors hover:bg-muted/60', n.read && 'opacity-55')}
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
                    <div className="flex shrink-0 flex-col justify-center gap-0.5 py-2 pr-2.5">
                      <button
                        onClick={() => {
                          setNotificationOverride(n.id, { read: !n.read });
                          run(setNotificationRead(n.id, !n.read), 'Could not update');
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={n.read ? `Mark "${n.title}" as unread` : `Mark "${n.title}" as read`}
                        title={n.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        {n.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setNotificationOverride(n.id, { dismissed: true });
                          run(dismissNotification(n.id), 'Could not dismiss');
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label={`Dismiss "${n.title}"`}
                        title="Dismiss"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
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
