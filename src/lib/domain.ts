import type { BOMComponent, Booking, BookingQuote, BookingStatus, MaintenanceRecord, PowerType, RatePeriod, Unit, UnitSize, UnitStatus, UnitType } from '@/types';

export const COMPONENT_LABELS: Record<BOMComponent['type'], string> = {
  COMPRESSOR: 'Compressor',
  EVAPORATOR: 'Evaporator',
  CONTROLLER: 'Controller',
  FAN_MOTOR: 'Fan motor',
  CONTACTOR: 'Contactor',
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
  INDUSTRIAL: 'Commando',
  OTHER: 'Other',
};

/** Full power description for a booking, using the free text for OTHER. */
export function powerLabel(b: Pick<Booking, 'powerAvailable' | 'powerOther'>): string {
  return b.powerAvailable === 'OTHER' ? (b.powerOther?.trim() ? `Other: ${b.powerOther.trim()}` : 'Other') : POWER_LABELS[b.powerAvailable];
}

/** Compact power tag for cards: 13A, Commando or the free text. */
export function powerShort(b: Pick<Booking, 'powerAvailable' | 'powerOther'>): string {
  return b.powerAvailable === 'STANDARD' ? '13A' : b.powerAvailable === 'INDUSTRIAL' ? 'Commando' : b.powerOther?.trim() || 'Other power';
}

export const RATE_PERIOD_LABELS: Record<RatePeriod, string> = { DAY: 'per day', WEEK: 'per week' };

/** Hire days are inclusive of delivery and collection day; weekly rates charge whole weeks. */
export function lineCharge(b: Pick<Booking, 'startDate' | 'endDate' | 'rate' | 'ratePeriod'>): { qty: number; unit: string; amount: number } {
  const days = Math.max(1, Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 86_400_000) + 1);
  const weekly = b.ratePeriod === 'WEEK';
  const qty = weekly ? Math.ceil(days / 7) : days;
  return { qty, unit: weekly ? (qty === 1 ? 'week' : 'weeks') : qty === 1 ? 'day' : 'days', amount: round2(qty * (b.rate ?? 0)) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const DEFAULT_VAT_RATE = 20;

/** Totals for a booking: unit hire lines (from each line's rate) plus the shared quote extras. */
export function quoteTotals(lines: Pick<Booking, 'startDate' | 'endDate' | 'rate' | 'ratePeriod' | 'status'>[], quote?: BookingQuote) {
  const hire = round2(lines.filter((l) => l.status !== 'CANCELLED').reduce((sum, l) => sum + lineCharge(l).amount, 0));
  const extras = round2((quote?.extras ?? []).reduce((sum, e) => sum + e.quantity * e.unitPrice, 0));
  const discount = round2(Math.min(quote?.discount ?? 0, hire + extras));
  const net = round2(hire + extras - discount);
  const vatRate = quote?.vatRate ?? DEFAULT_VAT_RATE;
  const vat = round2((net * vatRate) / 100);
  return { hire, extras, discount, net, vatRate, vat, total: round2(net + vat) };
}

/** One status for a whole booking, from its unit lines. */
export function bookingGroupStatus(statuses: BookingStatus[]): BookingStatus {
  if (statuses.some((s) => s === 'ON_HIRE')) return 'ON_HIRE';
  if (statuses.some((s) => s === 'CONFIRMED')) return 'CONFIRMED';
  if (statuses.every((s) => s === 'CANCELLED')) return 'CANCELLED';
  return 'COLLECTED';
}

export type UnitDisplayStatus = UnitStatus | 'BREAKDOWN';

/** Breakdown overrides the stored status for display, so a broken unit on hire still stands out. */
export function unitDisplayStatus(u: Pick<Unit, 'status' | 'breakdown'>): UnitDisplayStatus {
  return u.breakdown ? 'BREAKDOWN' : u.status;
}

/** Next service due: a manually scheduled date wins over the last service record's. */
export function nextServiceDate(u: Pick<Unit, 'nextServiceDate' | 'maintenanceHistory'>): string | undefined {
  return (
    u.nextServiceDate ??
    (u.maintenanceHistory ?? [])
      .map((r) => r.nextServiceDate)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1)
  );
}

export type Tone = 'success' | 'info' | 'scheduled' | 'warning' | 'danger' | 'neutral';

/** Single source of truth for status semantics across badges, timeline bars and charts. */
export const STATUS_META: Record<UnitDisplayStatus | BookingStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  ON_HIRE: { label: 'On hire', tone: 'info' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  BREAKDOWN: { label: 'Breakdown', tone: 'danger' },
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
