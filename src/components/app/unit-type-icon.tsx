import { Refrigerator, Snowflake, Warehouse, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnitType } from '@/types';

export const UNIT_TYPE_ICON: Record<UnitType, LucideIcon> = {
  COLD_STORE: Warehouse,
  UPRIGHT_FRIDGE: Refrigerator,
  CHEST_FREEZER: Snowflake,
};

export function UnitTypeIcon({ type, className, boxed }: { type: UnitType; className?: string; boxed?: boolean }) {
  const Icon = UNIT_TYPE_ICON[type];
  if (!boxed) return <Icon className={cn('size-4 text-muted-foreground', className)} aria-hidden />;
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50', className)}>
      <Icon className="size-4 text-foreground/70" aria-hidden />
    </span>
  );
}

/** Monospace unit code chip, e.g. CS-04 */
export function UnitCode({ id, className }: { id: string; className?: string }) {
  return <span className={cn('font-mono-unit text-[13px] text-foreground', className)}>{id}</span>;
}
