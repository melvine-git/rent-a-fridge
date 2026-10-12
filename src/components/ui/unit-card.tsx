'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Unit } from '@/types';

interface UnitCardProps {
  unit: Unit;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeLabels = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
} as const;

const powerLabels = {
  STANDARD: 'Standard Power',
  INDUSTRIAL: 'Industrial Power',
} as const;

export function UnitCard({ unit, selected, onClick, className }: UnitCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-[var(--brand-red)] ring-offset-2',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{unit.id}</h3>
          <StatusBadge status={unit.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{sizeLabels[unit.size]}</span>
          <span>•</span>
          <span>{powerLabels[unit.powerType]}</span>
        </div>
        {unit.notes && (
          <p className="text-xs text-muted-foreground italic">{unit.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
