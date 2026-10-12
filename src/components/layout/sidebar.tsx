'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Calendar, Truck, Users, Box, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/bookings', label: 'Bookings', icon: Calendar, description: 'Calendar & scheduling' },
  { href: '/deliveries', label: 'Deliveries', icon: Truck, description: 'Driver jobs' },
  { href: '/customers', label: 'Customers', icon: Users, description: 'Client records' },
  { href: '/units', label: 'Units', icon: Box, description: 'Fleet inventory' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <>
      {/* Navigation */}
      <nav className="flex-1 p-4 lg:p-5 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-3 lg:gap-4 px-3 lg:px-4 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--brand-red)] text-white shadow-lg shadow-[var(--brand-red)]/20'
                  : 'text-[var(--warm-gray-300)] hover:bg-[var(--charcoal-light)] hover:text-white'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-[var(--brand-red)] rounded-xl lg:rounded-2xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3 lg:gap-4">
                <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-[var(--warm-gray-400)]')} />
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className={cn('text-xs', isActive ? 'text-white/70' : 'text-[var(--warm-gray-500)]')}>
                    {item.description}
                  </div>
                </div>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 lg:p-5 border-t border-[var(--charcoal-light)]">
        <div className="text-xs text-[var(--warm-gray-500)] text-center">
          Operations Dashboard
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <aside className="hidden lg:flex w-64 bg-[var(--charcoal)] min-h-[calc(100vh-5rem)] flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar - drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-[var(--charcoal)] z-50 flex flex-col shadow-2xl"
            >
              {/* Close button */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--charcoal-light)]">
                <span className="text-white font-semibold">Menu</span>
                <button 
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl bg-[var(--charcoal-light)] flex items-center justify-center hover:bg-[var(--warm-gray-600)] transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
