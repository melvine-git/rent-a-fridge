'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { importBookings, importCustomers, parseImportFile, type BookingImportRow, type CustomerImportRow, type ImportResult } from '@/lib/actions';
import { FileUp, Loader2 } from 'lucide-react';
import type { BookingStatus } from '@/types';

type Kind = 'customers' | 'bookings';

type Draft = { label: string; detail: string; issue?: string; payload: BookingImportRow | CustomerImportRow };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const CUSTOMER_COLS: Record<string, number> = { name: 0, customer: 0, company: 0, business: 0, phone: 1, tel: 1, telephone: 1, mobile: 1, contactnumber: 1, email: 2, mail: 2, address: 3, site: 3, location: 3, addr: 3 };
const BOOKING_COLS: Record<string, number> = {
  customer: 0, customername: 0, name: 0, company: 0,
  unit: 1, unitid: 1, unitcode: 1, fridge: 1, unitno: 1,
  start: 2, startdate: 2, from: 2, delivered: 2, delivery: 2, deliverydate: 2, hirestart: 2,
  end: 3, enddate: 3, to: 3, collected: 3, collection: 3, collectiondate: 3, returned: 3, hireend: 3,
  status: 4, rate: 5, price: 5, weeklyrate: 5, dailyrate: 5, amount: 5,
  contact: 6, contactname: 6, phone: 7, contactphone: 7, tel: 7,
  address: 8, site: 8, deliveryaddress: 8, location: 8,
  notes: 9, note: 9, comments: 9, comment: 9,
};

/** Locate each logical column in a header row; null when the row isn't a header. */
function columnMap(header: string[], cols: Record<string, number>): number[] | null {
  const found = new Map<number, number>(); // logical index -> column index
  header.forEach((cell, i) => {
    const logical = cols[norm(cell)];
    if (logical !== undefined && !found.has(logical)) found.set(logical, i);
  });
  if (!found.has(0) || !found.has(1)) return null;
  const width = Math.max(...Object.values(cols)) + 1;
  return [...Array(width)].map((_, i) => found.get(i) ?? -1);
}

const cell = (row: string[], i: number) => (i >= 0 ? row[i]?.trim() ?? '' : '');

/** DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY or ISO -> YYYY-MM-DD; undefined when unparseable. */
function parseDate(s: string): string | undefined {
  const t = s.trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return undefined;
}

const STATUS_WORDS: Record<string, BookingStatus> = { confirmed: 'CONFIRMED', onhire: 'ON_HIRE', 'on hire': 'ON_HIRE', collected: 'COLLECTED', complete: 'COLLECTED', completed: 'COLLECTED', cancelled: 'CANCELLED', canceled: 'CANCELLED' };

function toDrafts(kind: Kind, rows: string[][]): Draft[] {
  const cols = kind === 'customers' ? CUSTOMER_COLS : BOOKING_COLS;
  const map = columnMap(rows[0] ?? [], cols);
  const data = map ? rows.slice(1) : rows; // no header -> assume the documented column order
  const pick = (row: string[], logical: number) => cell(row, map ? map[logical]! : logical);
  return data.map((row) => {
    if (kind === 'customers') {
      const d: CustomerImportRow = { name: pick(row, 0), phone: pick(row, 1) || undefined, email: pick(row, 2) || undefined, address: pick(row, 3) || undefined };
      return { label: d.name || '(blank)', detail: [d.phone, d.email].filter(Boolean).join(' · '), issue: d.name ? undefined : 'No name', payload: d };
    }
    const startDate = parseDate(pick(row, 2));
    const endDate = parseDate(pick(row, 3));
    const status = STATUS_WORDS[pick(row, 4).toLowerCase()];
    const rate = Number(pick(row, 5).replace(/[^0-9.]/g, ''));
    const d: BookingImportRow = {
      customerName: pick(row, 0),
      unitId: pick(row, 1),
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      status,
      contactName: pick(row, 6) || undefined,
      contactPhone: pick(row, 7) || undefined,
      address: pick(row, 8) || undefined,
      rate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
      notes: pick(row, 9) || undefined,
    };
    let issue: string | undefined;
    if (!d.customerName || !d.unitId) issue = 'Missing customer or unit';
    else if (!startDate || !endDate) issue = 'Unreadable dates. Use DD/MM/YYYY';
    return { label: `${d.customerName || '(blank)'} · ${d.unitId || '?'}`, detail: `${pick(row, 2)} → ${pick(row, 3)}`, issue, payload: d };
  });
}

const HELP: Record<Kind, string> = {
  customers: 'Columns: name, phone, email, address. A header row is auto-detected.',
  bookings: 'Columns: customer, unit, start date, end date (then status, rate, contact, phone, site, notes). Dates DD/MM/YYYY or YYYY-MM-DD. Unknown customers are created; units must already exist.',
};

const ACCEPT = '.csv,.txt,.tsv,.psv,text/csv,text/plain';

export function ImportDialog({ kind, open, onOpenChange, onDone }: { kind: Kind; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isParsing, startParse] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [fileName, setFileName] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const ready = drafts.filter((d) => !d.issue);

  const pick = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const data = new FormData();
    data.append('file', file);
    startParse(async () => {
      const r = await parseImportFile(data).catch(() => ({ success: false as const, error: 'Upload failed' }));
      if (!r.success || !r.rows) {
        toast.error('Could not read file', { description: r.error });
        setDrafts([]);
        return;
      }
      const d = toDrafts(kind, r.rows).filter((x) => x.label !== '(blank)' || x.issue !== 'No name');
      setDrafts(d);
      if (!d.length) toast.error('Nothing to import', { description: 'The file had no usable rows.' });
    });
  };

  const run = () => {
    startSave(async () => {
      const r =
        kind === 'customers'
          ? await importCustomers(ready.map((d) => d.payload as CustomerImportRow))
          : await importBookings(ready.map((d) => d.payload as BookingImportRow));
      if (r.success) {
        setResult(r);
        toast.success(`Imported ${r.imported} ${kind === 'customers' ? 'customers' : 'bookings'}`, {
          description: [r.createdCustomers ? `${r.createdCustomers} customers created` : '', r.skipped.length ? `${r.skipped.length} rows skipped` : ''].filter(Boolean).join(' · ') || undefined,
        });
        if (r.imported) onDone();
      } else toast.error('Import failed', { description: r.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Import {kind === 'customers' ? 'customers' : 'booking history'}</DialogTitle>
          <DialogDescription>{HELP[kind]} Accepts .csv, .txt, .tsv or .psv. Commas, semicolons, tabs and pipes all split columns.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files)} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-9 gap-1.5">
              <FileUp className="size-4" /> Choose file
            </Button>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{fileName || 'No file chosen'}</span>
            {isParsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          {drafts.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {drafts.slice(0, 50).map((d, i) => (
                    <tr key={i} className={d.issue ? 'bg-red-50/60 text-red-700' : ''}>
                      <td className="px-3 py-2 font-medium">{d.label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.issue ?? d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drafts.length > 50 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">…and {drafts.length - 50} more rows</p>}
            </div>
          )}
          {result && result.skipped.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              {result.skipped.slice(0, 20).map((s, i) => (
                <p key={i}>
                  Skipped {s.name}: {s.reason}
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4">
            Close
          </Button>
          <Button onClick={run} disabled={!ready.length || isSaving} className="h-9 gap-1.5 px-4 hover:bg-(--brand-red-dark)">
            {isSaving && <Loader2 className="animate-spin" />}
            {isSaving ? 'Importing…' : `Import ${ready.length} ${kind === 'customers' ? 'customers' : 'bookings'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
