import { cn } from '@/lib/utils';
import { STATUS_META, TONE_CLASSES, type Tone } from '@/lib/domain';
import type { UnitStatus, BookingStatus } from '@/types';

type StatusType = UnitStatus | BookingStatus;

interface PillProps {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  showDot?: boolean;
}

export function Pill({ tone, children, className, showDot = false }: PillProps) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        t.badge,
        className
      )}
    >
      {showDot && <span className={cn('size-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <Pill tone={meta.tone} showDot={showDot} className={className}>
      {meta.label}
    </Pill>
  );
}
