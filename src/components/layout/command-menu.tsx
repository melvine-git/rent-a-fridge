'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Box, CalendarDays, CalendarPlus, CornerDownLeft, Search, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShellData } from '@/types';

type Item = { key: string; group: string; label: string; sublabel?: string; href: string; icon: LucideIcon };

const ACTIONS: Item[] = [
  { key: 'a-new', group: 'Actions', label: 'Create new booking', href: '/bookings/new', icon: CalendarPlus },
  { key: 'a-dash', group: 'Go to', label: 'Dashboard', href: '/dashboard', icon: CalendarDays },
  { key: 'a-book', group: 'Go to', label: 'Bookings timeline', href: '/bookings', icon: CalendarDays },
  { key: 'a-units', group: 'Go to', label: 'Fleet units', href: '/units', icon: Box },
  { key: 'a-cust', group: 'Go to', label: 'Customers', href: '/customers', icon: Users },
];

const TYPE_META = {
  customer: { group: 'Customers', icon: Users },
  unit: { group: 'Units', icon: Box },
  booking: { group: 'Bookings', icon: CalendarDays },
} as const;

export function CommandMenu({
  open,
  onOpenChange,
  index,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: ShellData['searchIndex'];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    const matches = index
      .filter((e) => `${e.label} ${e.sublabel} ${e.id}`.toLowerCase().includes(q))
      .slice(0, 12)
      .map((e) => ({ key: `${e.type}-${e.id}`, group: TYPE_META[e.type].group, label: e.label, sublabel: e.sublabel, href: e.href, icon: TYPE_META[e.type].icon }));
    return [...matches, ...ACTIONS.filter((a) => a.label.toLowerCase().includes(q))];
  }, [query, index]);

  const updateQuery = (q: string) => {
    setQuery(q);
    setActive(0);
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) updateQuery('');
    onOpenChange(next);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (item?: Item) => {
    if (!item) return;
    handleOpenChange(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search customers, units, bookings…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No results for “{query}”</div>
          )}
          {items.map((item, i) => {
            const header = item.group !== items[i - 1]?.group ? item.group : null;
            return (
              <div key={item.key}>
                {header && <div className="px-2 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{header}</div>}
                <button
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm',
                    i === active ? 'bg-muted text-foreground' : 'text-foreground/90'
                  )}
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{item.label}</span>
                  {item.sublabel && <span className="truncate text-xs text-muted-foreground capitalize">{item.sublabel}</span>}
                  {i === active && <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
