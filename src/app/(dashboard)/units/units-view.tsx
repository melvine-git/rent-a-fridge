'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Snowflake, Zap, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Unit, UnitStatus } from '@/types';

interface UnitsViewProps {
  units: Unit[];
}

const sizeConfig = {
  SMALL: { label: 'Small', color: 'bg-blue-100 text-blue-700' },
  MEDIUM: { label: 'Medium', color: 'bg-purple-100 text-purple-700' },
  LARGE: { label: 'Large', color: 'bg-amber-100 text-amber-700' },
} as const;

const powerConfig = {
  STANDARD: { label: '13A Standard', icon: Zap, color: 'text-green-600' },
  INDUSTRIAL: { label: '32A Industrial', icon: Zap, color: 'text-orange-600' },
} as const;

const filterConfig = [
  { value: 'all', label: 'All Units', color: 'bg-[var(--charcoal)]' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-500' },
  { value: 'ON_HIRE', label: 'On Hire', color: 'bg-blue-500' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-gray-400' },
] as const;

export function UnitsView({ units }: UnitsViewProps) {
  const [filter, setFilter] = useState<'all' | UnitStatus>('all');

  const filteredUnits = filter === 'all' 
    ? units 
    : units.filter(u => u.status === filter);

  const counts = {
    all: units.length,
    AVAILABLE: units.filter(u => u.status === 'AVAILABLE').length,
    ON_HIRE: units.filter(u => u.status === 'ON_HIRE').length,
    MAINTENANCE: units.filter(u => u.status === 'MAINTENANCE').length,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap overflow-x-auto pb-1 -mx-1 px-1">
        {filterConfig.map((item) => {
          const count = counts[item.value as keyof typeof counts];
          const isActive = filter === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setFilter(item.value as typeof filter)}
              className={cn(
                'relative flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-[var(--charcoal)] text-white shadow-lg'
                  : 'bg-white text-[var(--charcoal)] hover:bg-[var(--warm-gray-100)] border border-[var(--warm-gray-200)]'
              )}
            >
              <span className={cn('w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full', item.color)} />
              <span className="hidden xs:inline">{item.label}</span>
              <span className="xs:hidden">{item.value === 'all' ? 'All' : item.label.split(' ')[0]}</span>
              <span className={cn(
                'ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold',
                isActive ? 'bg-white/20 text-white' : 'bg-[var(--warm-gray-100)] text-[var(--warm-gray-600)]'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)]">
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <div className="text-[var(--warm-gray-500)] font-medium">No units found</div>
            <div className="text-sm text-[var(--warm-gray-400)] mt-1">Try a different filter</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {filteredUnits.map((unit, index) => {
            const PowerIcon = powerConfig[unit.powerType].icon;
            return (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className={cn(
                  'rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 sm:hover:-translate-y-1 overflow-hidden group',
                  unit.status === 'MAINTENANCE' && 'opacity-75'
                )}>
                  <CardContent className="p-0">
                    {/* Header with unit ID */}
                    <div className={cn(
                      'px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between',
                      unit.status === 'AVAILABLE' && 'bg-gradient-to-r from-green-50 to-white',
                      unit.status === 'ON_HIRE' && 'bg-gradient-to-r from-blue-50 to-white',
                      unit.status === 'MAINTENANCE' && 'bg-gradient-to-r from-gray-100 to-white'
                    )}>
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className={cn(
                          'w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center',
                          unit.status === 'AVAILABLE' && 'bg-green-100',
                          unit.status === 'ON_HIRE' && 'bg-blue-100',
                          unit.status === 'MAINTENANCE' && 'bg-gray-200'
                        )}>
                          {unit.status === 'MAINTENANCE' ? (
                            <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                          ) : (
                            <Snowflake className={cn(
                              'h-4 w-4 sm:h-5 sm:w-5',
                              unit.status === 'AVAILABLE' && 'text-green-600',
                              unit.status === 'ON_HIRE' && 'text-blue-600'
                            )} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-mono-unit text-base sm:text-lg text-[var(--charcoal)]">{unit.id}</h3>
                        </div>
                      </div>
                      <StatusBadge status={unit.status} />
                    </div>

                    {/* Body */}
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 space-y-2.5 sm:space-y-3">
                      {/* Size & Power */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold',
                          sizeConfig[unit.size].color
                        )}>
                          {sizeConfig[unit.size].label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] sm:text-xs text-[var(--warm-gray-600)]">
                          <PowerIcon className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', powerConfig[unit.powerType].color)} />
                          {powerConfig[unit.powerType].label}
                        </span>
                      </div>

                      {/* Notes */}
                      {unit.notes && (
                        <p className="text-xs sm:text-sm text-[var(--warm-gray-500)] italic bg-[var(--warm-gray-50)] p-2 sm:p-2.5 rounded-lg">
                          {unit.notes}
                        </p>
                      )}

                      {/* Current Booking */}
                      {unit.currentBookingId && (
                        <div className="text-[10px] sm:text-xs text-[var(--warm-gray-500)] flex items-center gap-1.5 bg-blue-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Booking: <span className="font-mono-unit">{unit.currentBookingId}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
