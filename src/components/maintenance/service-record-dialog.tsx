'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { removeMaintenanceAttachment, saveMaintenanceRecord } from '@/lib/actions';
import { formatFileSize, toISODate } from '@/lib/format';
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, X } from 'lucide-react';
import type { Attachment, MaintenanceRecord, Unit } from '@/types';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';

export function AttachmentLinks({ files, onRemove }: { files?: Attachment[]; onRemove?: (a: Attachment) => void }) {
  if (!files?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {files.map((a) => (
        <li key={a.url} className="inline-flex max-w-full items-center rounded-md border bg-white text-xs">
          <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1 hover:underline" title={a.name}>
            {a.type === 'application/pdf' ? <FileText className="size-3.5 shrink-0 text-red-600" /> : <ImageIcon className="size-3.5 shrink-0 text-sky-600" />}
            <span className="truncate">{a.name}</span>
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(a)} className="flex size-6 items-center justify-center border-l text-muted-foreground hover:text-red-600" aria-label={`Remove ${a.name}`}>
              <X className="size-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Order numbers as removable chips; Enter or comma adds the typed number. */
function OrderNumbers({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft.split(',').map((p) => p.trim()).filter((p) => p && !value.includes(p));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-white px-2 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {value.map((o) => (
        <span key={o} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {o}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== o))} className="text-muted-foreground hover:text-foreground" aria-label={`Remove order ${o}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? 'Add another…' : 'Type an order number, press Enter'}
        className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Units to choose from; omit when the unit is fixed */
  units?: Unit[];
  unitId?: string;
  record?: MaintenanceRecord;
};

export function ServiceRecordDialog({ open, onOpenChange, onSaved, units, unitId: fixedUnitId, record }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isSaving, startSave] = useTransition();
  const [unitId, setUnitId] = useState(fixedUnitId ?? '');
  const [form, setForm] = useState({
    type: record?.type ?? ('SCHEDULED' as MaintenanceRecord['type']),
    date: record?.date ?? toISODate(new Date()),
    description: record?.description ?? '',
    performedBy: record?.performedBy ?? '',
    hoursWorked: record?.hoursWorked !== undefined ? String(record.hoursWorked) : '',
    partsReplaced: record?.partsReplaced?.join(', ') ?? '',
    nextServiceDate: record?.nextServiceDate ?? '',
  });
  const [orderNumbers, setOrderNumbers] = useState<string[]>(record?.orderNumbers ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>(record?.attachments ?? []);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => f.size > MAX_BYTES);
    if (bad) toast.error(`${bad.name} is larger than 10 MB`);
    setFiles((p) => [...p, ...picked.filter((f) => f.size <= MAX_BYTES)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeExisting = async (a: Attachment) => {
    if (!record || !unitId) return;
    const r = await removeMaintenanceAttachment(unitId, record.id, a.url);
    if (r.success) setExisting((p) => p.filter((x) => x.url !== a.url));
    else toast.error('Could not remove file', { description: r.error });
  };

  const save = () => {
    if (!unitId) return toast.error('Select a unit');
    if (!form.description.trim()) return toast.error('Describe the work carried out');
    const hours = form.hoursWorked.trim() === '' ? undefined : Number(form.hoursWorked);
    if (hours !== undefined && !(hours >= 0)) return toast.error('Enter hours worked as a number');
    const data = new FormData();
    files.forEach((f) => data.append('files', f));
    startSave(async () => {
      const r = await saveMaintenanceRecord(
        unitId,
        {
          id: record?.id,
          date: form.date,
          type: form.type,
          description: form.description,
          performedBy: form.performedBy,
          hoursWorked: hours,
          orderNumbers,
          partsReplaced: form.partsReplaced ? form.partsReplaced.split(',') : undefined,
          nextServiceDate: form.nextServiceDate || undefined,
        },
        files.length ? data : undefined
      );
      if (r.success) {
        toast.success(record ? 'Service record updated' : `Service logged for ${unitId}`);
        onSaved();
      } else toast.error('Could not save', { description: r.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{record ? 'Edit service record' : fixedUnitId ? `Log service for ${fixedUnitId}` : 'Log service'}</DialogTitle>
          <DialogDescription>Setting a next service date creates a reminder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {!fixedUnitId && units && (
              <Field label="Unit" required>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={selectClass}>
                  <option value="">Select…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Type">
              <select value={form.type} onChange={(e) => set('type', e.target.value as MaintenanceRecord['type'])} className={selectClass}>
                <option value="SCHEDULED">Scheduled service</option>
                <option value="REPAIR">Repair</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="h-9" />
            </Field>
          </div>
          <Field label="Work carried out" required>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Replaced evaporator fan, cleaned condenser coils" className={textareaClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Technician">
              <Input value={form.performedBy} onChange={(e) => set('performedBy', e.target.value)} className="h-9" />
            </Field>
            <Field label="Hours worked">
              <Input type="number" min="0" step="0.25" value={form.hoursWorked} onChange={(e) => set('hoursWorked', e.target.value)} placeholder="e.g. 2.5" className="h-9" />
            </Field>
          </div>
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-foreground">Order numbers</span>
            <OrderNumbers value={orderNumbers} onChange={setOrderNumbers} />
            <span className="block text-xs text-muted-foreground">Add as many as needed, e.g. parts orders and contractor POs</span>
          </div>
          <Field label="Parts replaced" hint="Separate multiple parts with commas">
            <Input value={form.partsReplaced} onChange={(e) => set('partsReplaced', e.target.value)} className="h-9" />
          </Field>
          <Field label="Next service date">
            <Input type="date" value={form.nextServiceDate} onChange={(e) => set('nextServiceDate', e.target.value)} className="h-9" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">Documents</span>
              <input ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} aria-label="Attach documents" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-8 gap-1 px-2.5 text-xs">
                <Paperclip /> Attach PDF or photo
              </Button>
            </div>
            <AttachmentLinks files={existing} onRemove={record ? removeExisting : undefined} />
            {files.length > 0 && (
              <ul className="divide-y rounded-md border">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                    <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600" aria-label={`Remove ${f.name}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!existing.length && !files.length && <p className="text-xs text-muted-foreground">Delivery notes, manual dockets or outsourced work. PDF or image, up to 10 MB each.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4">
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving} className="h-9 gap-1.5 px-4 hover:bg-[var(--brand-red-dark)]">
            {isSaving && <Loader2 className="animate-spin" />}
            {isSaving ? 'Saving…' : 'Save record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
