'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  Truck,
  PackageCheck,
  Users,
  Box,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShellData } from '@/types';

type NavItem = { href: string; label: string; icon: LucideIcon; count?: number; urgent?: boolean };

function buildNav(counts: ShellData['counts']): { section: string; items: NavItem[] }[] {
  return [
    {
      section: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      section: 'Operations',
      items: [
        { href: '/bookings', label: 'Bookings', icon: CalendarDays, count: counts.actionsOverdue, urgent: true },
        { href: '/deliveries', label: 'Deliveries', icon: Truck, count: counts.deliveriesToday },
        { href: '/collections', label: 'Collections', icon: PackageCheck, count: counts.collectionsDue, urgent: true },
      ],
    },
    {
      section: 'Fleet',
      items: [
        { href: '/units', label: 'Units', icon: Box },
        { href: '/maintenance', label: 'Maintenance', icon: Wrench, count: counts.serviceDue, urgent: true },
      ],
    },
    {
      section: 'Accounts',
      items: [{ href: '/customers', label: 'Customers', icon: Users }],
    },
  ];
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/dashboard" className={cn('flex items-center select-none', className)} aria-label="Andy Keery – go to dashboard">
      <Image src="/andy-keery-logo-light.svg" alt="Andy Keery Temperature Controlled Solutions" width={170} height={36} priority unoptimized />
    </Link>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  counts: ShellData['counts'];
}

export function Sidebar({ isOpen, onClose, counts }: SidebarProps) {
  const pathname = usePathname();
  const nav = buildNav(counts);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--sidebar-border)] px-5">
        <Logo />
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-stone-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main">
        {nav.map((group) => (
          <div key={group.section}>
            <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-stone-500">
              {group.section}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-red)]/60',
                        active ? 'bg-white/[0.08] text-white' : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-100'
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--brand-red)]" />}
                      <item.icon className={cn('size-4 shrink-0', active ? 'text-white' : 'text-stone-500')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.count && (
                        <span
                          className={cn(
                            'tabular min-w-5 rounded px-1.5 py-px text-center text-[11px] font-semibold',
                            item.urgent ? 'bg-[var(--brand-red)] text-white' : 'bg-white/10 text-stone-300'
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-[var(--sidebar)] lg:block">{content}</aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--sidebar)] shadow-2xl lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
