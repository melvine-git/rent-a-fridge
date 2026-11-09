'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import {
  ContactAndPowerFields,
  LinesEditor,
  QuoteEditor,
  lineError,
  lineFromBooking,
  lineToInput,
  newLine,
  quoteFromBooking,
  quoteToInput,
  siteError,
  type LineDraft,
  type SiteDraft,
} from '@/components/bookings/booking-editors';
import { checkBookingLines, updateBookingGroup } from '@/lib/actions';
import { UNIT_TYPE_LABELS } from '@/lib/domain';
import { normalizeW3w } from '@/lib/format';
import { Loader2, Plus } from 'lucide-react';
import type { Unit } from '@/types';
import type { LineDetail } from './booking-units';

function siteFrom(b: LineDetail): SiteDraft {
  return {
    contactName: b.contactName,
    contactPhone: b.contactPhone,
    deliveryAddress: b.deliveryAddress,
    what3wordsAddress: b.what3wordsAddress ?? '',
    accessInstructions: b.accessInstructions ?? '',
    powerAvailable: b.powerAvailable,
    powerOther: b.powerOther ?? '',
    application: b.application ?? '',
  };
}

export function EditBookingSheet({
  reference,
  lines: bookingLines,
  units,
  open,
  onOpenChange,
  onSaved,
}: {
  reference: string;
  lines: LineDetail[];
  units: Unit[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const first = bookingLines[0];
  const [site, setSite] = useState(() => siteFrom(first));
  const [followUp, setFollowUp] = useState({ notes: first.notes ?? '', actionDate: first.actionDate ?? '', actionDescription: first.actionDescription ?? '' });
  const [lines, setLines] = useState<LineDraft[]>(() => bookingLines.filter((l) => l.status === 'CONFIRMED' || l.status === 'ON_HIRE').map(lineFromBooking));
  const [cancelIds, setCancelIds] = useState<string[]>([]);
  const [quote, setQuote] = useState(() => quoteFromBooking(first.quote));
  const [conflicts, setConflicts] = useState<Record<string, string | null>>({});
  const [addUnitId, setAddUnitId] = useState('');
  const [isPending, startTransition] = useTransition();
  // Collected units are still charged, so they stay in the quote
  const collected = bookingLines.filter((l) => l.status === 'COLLECTED').map(lineFromBooking);

  const linesKey = JSON.stringify(lines.map((l) => [l.key, l.unitId, l.startDate, l.endDate]));
  useEffect(() => {
    if (!open || lines.length === 0) return;
    let cancelled = false;
    checkBookingLines(lines.map(lineToInput)).then((res) => {
      if (!cancelled) setConflicts(Object.fromEntries(lines.map((l, i) => [l.key, res[i]])));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linesKey captures the fields that matter
  }, [open, linesKey]);

  const updateLine = (key: string, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => {
    const line = lines.find((l) => l.key === key);
    if (line?.id) setCancelIds((ids) => [...ids, line.id!]);
    setLines((ls) => ls.filter((l) => l.key !== key));
  };
  const addUnit = () => {
    const unit = units.find((u) => u.id === addUnitId);
    if (!unit) return;
    const ref = lines[0] ?? lineFromBooking(first);
    setLines((ls) => [...ls, newLine(unit, { startDate: ref.startDate, endDate: ref.endDate, deliveryTime: ref.deliveryTime, collectionTime: ref.collectionTime, cableLength: ref.cableLength })]);
    setAddUnitId('');
  };

  const problem = siteError(site) ?? (lines.length === 0 ? 'Keep at least one unit, or cancel the booking instead' : null);
  const linesOk = lines.every((l) => !lineError(l) && !conflicts[l.key]);
  const canSave = !problem && linesOk;
  const onBooking = new Set(lines.map((l) => l.unitId));

  const save = () =>
    startTransition(async () => {
      const result = await updateBookingGroup(reference, {
        shared: {
          contactName: site.contactName.trim(),
          contactPhone: site.contactPhone.trim(),
          deliveryAddress: site.deliveryAddress.trim(),
          deliveryAddressId: site.deliveryAddress.trim() === first.deliveryAddress ? first.deliveryAddressId : undefined,
          what3wordsAddress: normalizeW3w(site.what3wordsAddress),
          accessInstructions: site.accessInstructions.trim() || undefined,
          powerAvailable: site.powerAvailable,
          powerOther: site.powerOther,
          application: site.application.trim() || undefined,
          notes: followUp.notes.trim() || undefined,
          actionDate: followUp.actionDate || undefined,
          actionDescription: followUp.actionDescription.trim() || undefined,
          quote: quoteToInput(quote),
        },
        lines: lines.map(lineToInput),
        cancelIds,
      });
      if (result.success) {
        toast.success('Booking updated');
        onSaved();
      } else {
        toast.error('Could not save changes', { description: result.error });
      }
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base font-semibold">Edit booking</SheetTitle>
          <SheetDescription>
            {first.customer.name} · <span className="font-mono-unit">{reference}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Group title="Units">
            <LinesEditor lines={lines} units={units} conflicts={conflicts} onChange={updateLine} onRemove={removeLine} />
            <div className="flex gap-2">
              <select value={addUnitId} onChange={(e) => setAddUnitId(e.target.value)} className={selectClass} aria-label="Unit to add">
                <option value="">Add another unit to this booking…</option>
                {units
                  .filter((u) => !onBooking.has(u.id) && u.status !== 'MAINTENANCE' && !u.breakdown)
                  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id} · {UNIT_TYPE_LABELS[u.unitType]}
                    </option>
                  ))}
              </select>
              <Button type="button" variant="outline" onClick={addUnit} disabled={!addUnitId} className="h-9 shrink-0 gap-1 px-3">
                <Plus /> Add
              </Button>
            </div>
            {cancelIds.length > 0 && <p className="text-xs text-amber-700">{cancelIds.length} unit{cancelIds.length > 1 ? 's' : ''} will be removed from this booking when you save.</p>}
          </Group>

          <Group title="Site & contact">
            <ContactAndPowerFields value={site} onChange={(patch) => setSite((s) => ({ ...s, ...patch }))} />
            <Field label="Delivery address" required>
              <Input value={site.deliveryAddress} onChange={(e) => setSite((s) => ({ ...s, deliveryAddress: e.target.value }))} className="h-9" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="what3words location">
                <Input value={site.what3wordsAddress} onChange={(e) => setSite((s) => ({ ...s, what3wordsAddress: e.target.value }))} placeholder="///filled.count.soap" className="h-9" />
              </Field>
              <Field label="Access instructions">
                <Input value={site.accessInstructions} onChange={(e) => setSite((s) => ({ ...s, accessInstructions: e.target.value }))} className="h-9" />
              </Field>
            </div>
          </Group>

          <Group title="Pricing">
            <QuoteEditor lines={[...lines, ...collected]} value={quote} onChange={setQuote} />
          </Group>

          <Group title="Follow-up & notes">
            <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
              <Field label="Action date">
                <Input type="date" value={followUp.actionDate} onChange={(e) => setFollowUp((f) => ({ ...f, actionDate: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Action required">
                <Input value={followUp.actionDescription} onChange={(e) => setFollowUp((f) => ({ ...f, actionDescription: e.target.value }))} className="h-9" />
              </Field>
            </div>
            <Field label="Internal notes">
              <textarea value={followUp.notes} onChange={(e) => setFollowUp((f) => ({ ...f, notes: e.target.value }))} className={textareaClass} />
            </Field>
          </Group>
        </div>

        <div className="space-y-2 border-t px-5 py-4">
          {problem && <p className="text-xs font-medium text-red-600">{problem}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-4">
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave || isPending} className="h-10 flex-1 gap-1.5 font-semibold hover:bg-[var(--brand-red-dark)]">
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
