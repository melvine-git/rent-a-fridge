'use client';

import { cn } from '@/lib/utils';
import type { UnitStatus, BookingStatus } from '@/types';

type StatusType = UnitStatus | BookingStatus;

const statusConfig: Record<StatusType, { label: string; className: string; dotColor: string }> = {
  AVAILABLE: {
    label: 'Available',
    className: 'bg-green-50 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
  },
  ON_HIRE: {
    label: 'On Hire',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    dotColor: 'bg-gray-400',
  },
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    dotColor: 'bg-purple-500',
  },
  COLLECTED: {
    label: 'Collected',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    dotColor: 'bg-gray-400',
  },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border',
        config.className,
        className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />}
      {config.label}
    </span>
  );
}
