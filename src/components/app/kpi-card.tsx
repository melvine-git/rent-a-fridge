import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, type Tone } from '@/lib/domain';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  /** 0–100, renders a slim progress bar under the value */
  progress?: number;
  emphasis?: boolean;
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'neutral', href, progress, emphasis }: KpiCardProps) {
  const t = TONE_CLASSES[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('flex size-7 items-center justify-center rounded-md', t.soft)}>
            <Icon className={cn('size-4', t.text)} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn('tabular text-3xl font-semibold tracking-tight', emphasis ? t.text : 'text-foreground')}>
          {value}
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', t.dot)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      {href && (
        <ArrowUpRight className="absolute right-3 bottom-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  );

  const className = 'surface group relative block p-4 transition-shadow';
  return href ? (
    <Link href={href} className={cn(className, 'hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40 outline-none')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
