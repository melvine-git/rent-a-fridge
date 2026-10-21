import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  danger: { wrap: 'border-red-200', head: 'bg-red-50/70', icon: 'text-red-600', title: 'text-red-900', desc: 'text-red-800/70', divide: 'divide-red-100' },
  warning: { wrap: 'border-amber-200', head: 'bg-amber-50/70', icon: 'text-amber-600', title: 'text-amber-900', desc: 'text-amber-800/70', divide: 'divide-amber-100' },
  info: { wrap: 'border-sky-200', head: 'bg-sky-50/70', icon: 'text-sky-600', title: 'text-sky-900', desc: 'text-sky-800/70', divide: 'divide-sky-100' },
} as const;

interface AlertBannerProps {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** Inline alert with optional list body (children should be <li> elements). */
export function AlertBanner({ tone, icon: Icon, title, description, action, children, className }: AlertBannerProps) {
  const t = TONES[tone];
  return (
    <section className={cn('overflow-hidden rounded-[var(--radius-lg)] border bg-white shadow-[var(--shadow-xs)]', t.wrap, className)}>
      <div className={cn('flex items-center gap-3 px-4 py-3', t.head)}>
        <Icon className={cn('size-4 shrink-0', t.icon)} />
        <div className="min-w-0 flex-1">
          <span className={cn('text-sm font-semibold', t.title)}>{title}</span>
          {description && <span className={cn('ml-2 hidden text-sm sm:inline', t.desc)}>{description}</span>}
        </div>
        {action}
      </div>
      {children && <ul className={cn('divide-y', t.divide)}>{children}</ul>}
    </section>
  );
}
