'use client';

import { Input } from '@/components/ui/input';
import { Field, selectClass } from '@/components/app/field';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { GBP, DEFAULT_VAT_RATE, POWER_LABELS, RATE_PERIOD_LABELS, UNIT_TYPE_LABELS, lineCharge, quoteTotals, round2 } from '@/lib/domain';
import { daysBetween, isValidW3w } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Check, Lock, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { Booking, BookingAccessories, BookingLineInput, BookingQuote, CableLength, PowerType, RatePeriod, Unit, UnitType } from '@/types';

export const CABLE_LENGTHS: CableLength[] = ['5m', '10m', '15m', '20m', '25m', '30m'];

export const ACCESSORIES: { key: keyof BookingAccessories; label: string }[] = [
  { key: 'hitchLock', label: 'Hitch lock' },
  { key: 'wheelClamp', label: 'Wheel clamp' },
  { key: 'doorLock', label: 'Door lock' },
  { key: 'tempRecorder', label: 'Temp recorder' },
];

const NO_ACCESSORIES: BookingAccessories = { hitchLock: false, wheelClamp: false, doorLock: false, tempRecorder: false };

export const DEFAULT_TEMP: Record<UnitType, number> = { COLD_STORE: 4, UPRIGHT_FRIDGE: 4, CHEST_FREEZER: -18 };

// ============ Unit lines ============

export interface LineDraft {
  key: string;
  /** Existing unit line id when editing */
  id?: string;
  status?: Booking['status'];
  unitId: string;
  startDate: string;
  endDate: string;
  deliveryTime: string;
  collectionTime: string;
  tempRequired: string;
  cableLength: CableLength | '';
  accessories: BookingAccessories;
  rate: string;
  ratePeriod: RatePeriod;
}

let keySeq = 0;
const nextKey = () => `line-${++keySeq}`;

export function newLine(unit: Unit, defaults: Pick<LineDraft, 'startDate' | 'endDate' | 'deliveryTime' | 'collectionTime'> & { tempRequired?: string; cableLength?: CableLength | '' }): LineDraft {
  return {
    key: nextKey(),
    unitId: unit.id,
    ...defaults,
    tempRequired: unit.unitType === 'CHEST_FREEZER' ? String(DEFAULT_TEMP.CHEST_FREEZER) : defaults.tempRequired ?? String(DEFAULT_TEMP[unit.unitType]),
    cableLength: defaults.cableLength ?? '10m',
    accessories: { ...NO_ACCESSORIES },
    rate: '',
    ratePeriod: 'WEEK',
  };
}

export function lineFromBooking(b: Booking): LineDraft {
  return {
    key: nextKey(),
    id: b.id,
    status: b.status,
    unitId: b.unitId,
    startDate: b.startDate,
    endDate: b.endDate,
    deliveryTime: b.deliveryTime ?? '',
    collectionTime: b.collectionTime ?? '',
    tempRequired: String(b.tempRequired),
    cableLength: b.cableLength ?? '',
    accessories: { ...NO_ACCESSORIES, ...b.accessories },
    rate: b.rate !== undefined ? String(b.rate) : '',
    ratePeriod: b.ratePeriod ?? 'WEEK',
  };
}

export function lineToInput(l: LineDraft): BookingLineInput & { id?: string } {
  const rate = l.rate.trim() === '' ? undefined : Number(l.rate);
  return {
    id: l.id,
    unitId: l.unitId,
    startDate: l.startDate,
    endDate: l.endDate,
    deliveryTime: l.deliveryTime || undefined,
    collectionTime: l.collectionTime || undefined,
    tempRequired: parseInt(l.tempRequired, 10),
    cableLength: l.cableLength || undefined,
    accessories: l.accessories,
    rate: rate !== undefined && Number.isFinite(rate) ? round2(rate) : undefined,
    ratePeriod: l.ratePeriod,
  };
}

export function lineError(l: LineDraft): string | null {
  if (!l.startDate || !l.endDate) return 'Set delivery and collection dates';
  if (l.endDate < l.startDate) return 'Collection is before delivery';
  if (!/^-?\d+$/.test(l.tempRequired.trim())) return 'Enter a temperature';
  if (l.rate.trim() !== '' && !(Number(l.rate) >= 0)) return 'Rate must be a positive amount';
  return null;
}

export function LinesEditor({
  lines,
  units,
  conflicts,
  onChange,
  onRemove,
}: {
  lines: LineDraft[];
  units: Unit[];
  conflicts: Record<string, string | null | undefined>;
  onChange: (key: string, patch: Partial<LineDraft>) => void;
  onRemove: (key: string) => void;
}) {
  if (lines.length === 0) {
    return <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Pick one or more units above. Each unit can have its own dates, temperature and rate.</p>;
  }
  return (
    <ul className="@container space-y-3">
      {lines.map((l) => {
        const unit = units.find((u) => u.id === l.unitId);
        const onHire = l.status === 'ON_HIRE';
        const problem = lineError(l) ?? conflicts[l.key];
        const set = (patch: Partial<LineDraft>) => onChange(l.key, patch);
        const days = l.startDate && l.endDate && l.endDate >= l.startDate ? daysBetween(l.startDate, l.endDate) : 0;
        const charge = lineCharge({ startDate: l.startDate, endDate: l.endDate, rate: Number(l.rate) || 0, ratePeriod: l.ratePeriod });
        return (
          <li key={l.key} className={cn('overflow-hidden rounded-md border bg-white', problem && 'border-red-300')}>
            <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              {unit && <UnitTypeIcon type={unit.unitType} />}
              <span className="font-mono-unit text-sm text-foreground">{l.unitId}</span>
              {unit && <span className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[unit.unitType]}</span>}
              {onHire && (
                <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                  <Lock className="size-3" /> On hire
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{days ? `${days} day${days > 1 ? 's' : ''}` : ''}</span>
              {!onHire && (
                <button type="button" onClick={() => onRemove(l.key)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${l.unitId}`}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </header>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
                <Field label="Delivery">
                  <Input type="date" value={l.startDate} disabled={onHire} onChange={(e) => set({ startDate: e.target.value })} className="h-9" />
                </Field>
                <Field label="Collection">
                  <Input type="date" value={l.endDate} min={l.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} className="h-9" />
                </Field>
                <Field label="Delivery time">
                  <Input type="time" value={l.deliveryTime} disabled={onHire} onChange={(e) => set({ deliveryTime: e.target.value })} className="h-9" />
                </Field>
                <Field label="Collection time">
                  <Input type="time" value={l.collectionTime} onChange={(e) => set({ collectionTime: e.target.value })} className="h-9" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
                <Field label="Temp (°C)">
                  <Input type="number" min="-25" max="15" value={l.tempRequired} onChange={(e) => set({ tempRequired: e.target.value })} className="h-9" />
                </Field>
                <Field label="Cable">
                  <select value={l.cableLength} onChange={(e) => set({ cableLength: e.target.value as CableLength | '' })} className={selectClass}>
                    <option value="">No cable</option>
                    {CABLE_LENGTHS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rate (£ ex VAT)">
                  <Input type="number" min="0" step="0.01" value={l.rate} onChange={(e) => set({ rate: e.target.value })} placeholder="0.00" className="h-9" />
                </Field>
                <Field label="Charged">
                  <select value={l.ratePeriod} onChange={(e) => set({ ratePeriod: e.target.value as RatePeriod })} className={selectClass}>
                    {(Object.keys(RATE_PERIOD_LABELS) as RatePeriod[]).map((p) => (
                      <option key={p} value={p}>
                        {RATE_PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ACCESSORIES.map(({ key, label }) => {
                  const on = l.accessories[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ accessories: { ...l.accessories, [key]: !on } })}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                        on ? 'border-[var(--brand-red)] bg-[var(--brand-red)]/5 text-foreground' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <span className={cn('flex size-3.5 items-center justify-center rounded-sm border', on ? 'border-[var(--brand-red)] bg-[var(--brand-red)] text-white' : 'border-input')}>
                        {on && <Check className="size-2.5" strokeWidth={3} />}
                      </span>
                      {label}
                    </button>
                  );
                })}
                {l.rate.trim() !== '' && Number(l.rate) > 0 && (
                  <span className="tabular ml-auto text-xs text-muted-foreground">
                    {charge.qty} {charge.unit} × {GBP.format(Number(l.rate))} = <span className="font-semibold text-foreground">{GBP.format(charge.amount)}</span>
                  </span>
                )}
              </div>
              {problem && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <TriangleAlert className="size-3.5" /> {problem}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ============ Site, contact & power ============

export interface SiteDraft {
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  what3wordsAddress: string;
  accessInstructions: string;
  powerAvailable: PowerType;
  powerOther: string;
  application: string;
}

export function siteError(s: SiteDraft): string | null {
  if (!s.contactName.trim()) return 'Enter the site contact name';
  if (!s.contactPhone.trim()) return 'Enter the site contact phone number';
  if (!s.deliveryAddress.trim()) return 'Enter the delivery address';
  if (s.what3wordsAddress.trim() && !isValidW3w(s.what3wordsAddress)) return 'what3words must be three words separated by dots';
  if (s.powerAvailable === 'OTHER' && !s.powerOther.trim()) return 'Describe the site power supply';
  return null;
}

/** Contact person on site (often not the hirer) and the site's power supply. */
export function ContactAndPowerFields({ value, onChange }: { value: SiteDraft; onChange: (patch: Partial<SiteDraft>) => void }) {
  return (
    <div className="@container space-y-4">
      <div className="grid gap-4 @md:grid-cols-2">
        <Field label="Site contact name" required hint="The person on site on the day. Often not the hirer.">
          <Input value={value.contactName} onChange={(e) => onChange({ contactName: e.target.value })} placeholder="e.g. Jane Smith" className="h-9" autoComplete="off" />
        </Field>
        <Field label="Site contact phone" required>
          <Input type="tel" value={value.contactPhone} onChange={(e) => onChange({ contactPhone: e.target.value })} placeholder="e.g. 07700 900123" className="h-9" autoComplete="off" />
        </Field>
      </div>
      {/* Two columns like the contact row; a third only when "Other" needs describing */}
      <div className={cn('grid gap-4 @md:grid-cols-2', value.powerAvailable === 'OTHER' && '@2xl:grid-cols-3')}>
        <Field label="Site power" required>
          <select value={value.powerAvailable} onChange={(e) => onChange({ powerAvailable: e.target.value as PowerType })} className={selectClass}>
            {(Object.keys(POWER_LABELS) as PowerType[]).map((p) => (
              <option key={p} value={p}>
                {POWER_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        {value.powerAvailable === 'OTHER' && (
          <Field label="Describe power supply" required>
            <Input value={value.powerOther} onChange={(e) => onChange({ powerOther: e.target.value })} placeholder="e.g. Generator, 16A blue" className="h-9" />
          </Field>
        )}
        <Field label="Application">
          <Input value={value.application} onChange={(e) => onChange({ application: e.target.value })} placeholder="e.g. fresh produce" className="h-9" />
        </Field>
      </div>
    </div>
  );
}

// ============ Quote ============

export interface ExtraDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface QuoteDraft {
  extras: ExtraDraft[];
  discount: string;
  vatRate: string;
  poNumber: string;
}

export const emptyQuote = (): QuoteDraft => ({ extras: [], discount: '', vatRate: String(DEFAULT_VAT_RATE), poNumber: '' });

export function quoteFromBooking(q?: BookingQuote): QuoteDraft {
  if (!q) return emptyQuote();
  return {
    extras: q.extras.map((e) => ({ id: e.id, description: e.description, quantity: String(e.quantity), unitPrice: String(e.unitPrice) })),
    discount: q.discount ? String(q.discount) : '',
    vatRate: String(q.vatRate),
    poNumber: q.poNumber ?? '',
  };
}

export function quoteToInput(q: QuoteDraft): BookingQuote {
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    extras: q.extras
      .filter((e) => e.description.trim())
      .map((e) => ({ id: e.id, description: e.description.trim(), quantity: num(e.quantity) || 1, unitPrice: round2(num(e.unitPrice)) })),
    discount: q.discount.trim() ? round2(num(q.discount)) : undefined,
    vatRate: q.vatRate.trim() === '' ? DEFAULT_VAT_RATE : num(q.vatRate),
    poNumber: q.poNumber.trim() || undefined,
  };
}

const PRESETS = ['Delivery charge', 'Collection charge', 'Extension cable hire', 'Cleaning'];

export function QuoteEditor({ lines, value, onChange }: { lines: LineDraft[]; value: QuoteDraft; onChange: (next: QuoteDraft) => void }) {
  const set = (patch: Partial<QuoteDraft>) => onChange({ ...value, ...patch });
  const setExtra = (id: string, patch: Partial<ExtraDraft>) => set({ extras: value.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addExtra = (description = '') => set({ extras: [...value.extras, { id: `x-${Date.now().toString(36)}${value.extras.length}`, description, quantity: '1', unitPrice: '' }] });
  const priced = lines.map((l) => ({ ...lineToInput(l), status: l.status ?? ('CONFIRMED' as const) }));
  const totals = quoteTotals(priced, quoteToInput(value));

  return (
    <div className="@container space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Price</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Amount</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {priced.map((l) => {
              const c = lineCharge(l);
              return (
                <tr key={l.id ?? l.unitId + l.startDate} className="text-muted-foreground">
                  <td className="px-3 py-2">
                    <span className="whitespace-nowrap text-foreground">Hire of {l.unitId}</span>
                    {l.rate === undefined && <span className="ml-2 text-xs text-amber-700">No rate set</span>}
                  </td>
                  <td className="tabular px-3 py-2 text-right whitespace-nowrap">
                    {c.qty} {c.unit}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{l.rate !== undefined ? GBP.format(l.rate) : '—'}</td>
                  <td className="tabular px-3 py-2 text-right text-foreground">{GBP.format(c.amount)}</td>
                  <td />
                </tr>
              );
            })}
            {value.extras.map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-1.5">
                  <Input value={e.description} onChange={(ev) => setExtra(e.id, { description: ev.target.value })} placeholder="Description" className="h-8" />
                </td>
                <td className="px-2 py-1.5">
                  <Input type="number" min="0" step="1" value={e.quantity} onChange={(ev) => setExtra(e.id, { quantity: ev.target.value })} className="h-8 text-right" />
                </td>
                <td className="px-2 py-1.5">
                  <Input type="number" min="0" step="0.01" value={e.unitPrice} onChange={(ev) => setExtra(e.id, { unitPrice: ev.target.value })} placeholder="0.00" className="h-8 text-right" />
                </td>
                <td className="tabular px-3 py-1.5 text-right text-foreground">{GBP.format((Number(e.quantity) || 0) * (Number(e.unitPrice) || 0))}</td>
                <td className="pr-1.5">
                  <button type="button" onClick={() => set({ extras: value.extras.filter((x) => x.id !== e.id) })} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label="Remove line">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-3 py-2">
          <button type="button" onClick={() => addExtra()} className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-xs font-medium hover:bg-muted">
            <Plus className="size-3.5" /> Add line
          </button>
          {PRESETS.filter((p) => !value.extras.some((e) => e.description === p)).map((p) => (
            <button key={p} type="button" onClick={() => addExtra(p)} className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              + {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 @2xl:grid-cols-[1fr_260px]">
        <div className="grid gap-3 self-start @md:grid-cols-[1.5fr_1fr_0.8fr]">
          <Field label="Customer PO number">
            <Input value={value.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder="Optional" className="h-9" />
          </Field>
          <Field label="Discount (£)">
            <Input type="number" min="0" step="0.01" value={value.discount} onChange={(e) => set({ discount: e.target.value })} placeholder="0.00" className="h-9" />
          </Field>
          <Field label="VAT (%)">
            <Input type="number" min="0" max="100" step="0.5" value={value.vatRate} onChange={(e) => set({ vatRate: e.target.value })} className="h-9" />
          </Field>
        </div>
        <QuoteTotals totals={totals} />
      </div>
    </div>
  );
}

export function QuoteTotals({ totals }: { totals: ReturnType<typeof quoteTotals> }) {
  const row = (label: string, value: number, strong = false) => (
    <div className={cn('flex justify-between gap-3', strong ? 'border-t pt-2 text-base font-semibold text-foreground' : 'text-muted-foreground')}>
      <dt>{label}</dt>
      <dd className="tabular">{GBP.format(value)}</dd>
    </div>
  );
  return (
    <dl className="space-y-1.5 rounded-md border bg-muted/20 p-3 text-sm">
      {row('Unit hire', totals.hire)}
      {totals.extras > 0 && row('Extras', totals.extras)}
      {totals.discount > 0 && row('Discount', -totals.discount)}
      {row('Net', totals.net)}
      {row(`VAT ${totals.vatRate}%`, totals.vat)}
      {row('Total', totals.total, true)}
    </dl>
  );
}
