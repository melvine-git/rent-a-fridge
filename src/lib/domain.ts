import type { BOMComponent, BookingStatus, MaintenanceRecord, PowerType, UnitSize, UnitStatus, UnitType } from '@/types';

export const COMPONENT_LABELS: Record<BOMComponent['type'], string> = {
  COMPRESSOR: 'Compressor',
  EVAPORATOR: 'Evaporator',
  CONTROLLER: 'Controller',
  FAN_MOTOR: 'Fan motor',
  OTHER: 'Other',
};

export const RECORD_TYPE_META: Record<MaintenanceRecord['type'], { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  REPAIR: { label: 'Repair', tone: 'danger' },
  INSPECTION: { label: 'Inspection', tone: 'success' },
};

export const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  COLD_STORE: 'Cold store',
  UPRIGHT_FRIDGE: 'Upright fridge',
  CHEST_FREEZER: 'Chest freezer',
};

export const UNIT_SIZE_LABELS: Record<UnitSize, string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

export const POWER_LABELS: Record<PowerType, string> = {
  STANDARD: '13A standard',
  INDUSTRIAL: '32A industrial',
};

export type Tone = 'success' | 'info' | 'scheduled' | 'warning' | 'danger' | 'neutral';

/** Single source of truth for status semantics across badges, timeline bars and charts. */
export const STATUS_META: Record<UnitStatus | BookingStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  ON_HIRE: { label: 'On hire', tone: 'info' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  CONFIRMED: { label: 'Scheduled', tone: 'scheduled' },
  COLLECTED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const TONE_CLASSES: Record<Tone, { badge: string; dot: string; solid: string; soft: string; text: string }> = {
  success: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-600 text-white',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  info: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    dot: 'bg-sky-500',
    solid: 'bg-sky-600 text-white',
    soft: 'bg-sky-50',
    text: 'text-sky-700',
  },
  scheduled: {
    badge: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    dot: 'bg-violet-500',
    solid: 'bg-violet-600 text-white',
    soft: 'bg-violet-50',
    text: 'text-violet-700',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    dot: 'bg-amber-500',
    solid: 'bg-amber-500 text-white',
    soft: 'bg-amber-50',
    text: 'text-amber-700',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
    solid: 'bg-red-600 text-white',
    soft: 'bg-red-50',
    text: 'text-red-700',
  },
  neutral: {
    badge: 'bg-stone-100 text-stone-600 ring-stone-500/20',
    dot: 'bg-stone-400',
    solid: 'bg-stone-500 text-white',
    soft: 'bg-stone-100',
    text: 'text-stone-600',
  },
};
