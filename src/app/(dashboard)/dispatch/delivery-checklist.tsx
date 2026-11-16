'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/status-badge';
import { SegmentedControl } from '@/components/app/segmented-control';
import { Check, ExternalLink, Eraser, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateDocketChecklist, completeDocket } from '@/lib/actions';
import { formatDate } from '@/lib/format';
import type { Tone } from '@/lib/domain';
import type { DeliveryDocket, DeliveryChecklist, Booking, Customer, Unit, Staff, CableLength } from '@/types';
import { cn } from '@/lib/utils';

type DocketWithDetails = DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff };

interface DeliveryChecklistProps {
  docket: DocketWithDetails;
  onComplete: () => void;
}

const CABLE_LENGTHS: CableLength[] = ['5m', '10m', '15m', '20m', '25m', '30m'];

const STATUS_TONE: Record<DeliveryDocket['status'], { tone: Tone; label: string }> = {
  SCHEDULED: { tone: 'scheduled', label: 'Scheduled' },
  IN_PROGRESS: { tone: 'warning', label: 'In progress' },
  COMPLETED: { tone: 'success', label: 'Completed' },
};

type BoolKey =
  | 'unitClean'
  | 'doorsSealed'
  | 'tempVerified'
  | 'powerConnected'
  | 'powerSupplyChecked'
  | 'powerCableConnected'
  | 'hitchLockSecured'
  | 'wheelClampSecured'
  | 'doorLockSecured';

const CORE_CHECKS: { key: BoolKey; label: string }[] = [
  { key: 'unitClean', label: 'Unit clean' },
  { key: 'doorsSealed', label: 'Door seals checked' },
  { key: 'tempVerified', label: 'Temperature verified' },
  { key: 'powerSupplyChecked', label: 'Site power checked' },
  { key: 'powerCableConnected', label: 'Power cable connected' },
  { key: 'powerConnected', label: 'Unit powered on' },
];

const LOCK_CHECKS: { key: BoolKey; label: string }[] = [
  { key: 'hitchLockSecured', label: 'Hitch lock' },
  { key: 'wheelClampSecured', label: 'Wheel clamp' },
  { key: 'doorLockSecured', label: 'Door lock' },
];

export function DeliveryChecklistComponent({ docket, onComplete }: DeliveryChecklistProps) {
  const [checklist, setChecklist] = useState<DeliveryChecklist>(docket.checklist);
  const [signedBy, setSignedBy] = useState(docket.signedBy || '');
  const [what3words, setWhat3words] = useState(docket.what3wordsAddress || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(docket.signatureData || null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  }, []);

  const handleChecklistChange = async (key: keyof DeliveryChecklist, value: boolean | number | CableLength) => {
    setChecklist((prev) => ({ ...prev, [key]: value }));
    await updateDocketChecklist(docket.id, { [key]: value });
  };

  const point = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    // Scale from CSS pixels to canvas pixels so strokes line up at any width
    return { x: ((cx - rect.left) * canvas.width) / rect.width, y: ((cy - rect.top) * canvas.height) / rect.height };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) setSignatureData(canvasRef.current.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleComplete = async () => {
    if (!signedBy) {
      toast.error('Enter the name of the person signing');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await completeDocket(docket.id, signedBy, signatureData || undefined, what3words || undefined);
      if (result.success) {
        toast.success(`${docket.type === 'DELIVERY' ? 'Delivery' : 'Collection'} completed`);
        onComplete();
      } else {
        toast.error(result.error || 'Failed to complete');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const coreDone = CORE_CHECKS.filter((c) => checklist[c.key]).length;
  const completed = docket.status === 'COMPLETED';
  const status = STATUS_TONE[docket.status];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 text-sm">
          <span className="font-mono-unit text-[13px] text-foreground">{docket.unit.id}</span>
          <span className="text-muted-foreground"> · {docket.customer.name}</span>
          <div className="text-xs text-muted-foreground">
            {formatDate(docket.scheduledDate)}
            {docket.scheduledTime && ` at ${docket.scheduledTime}`}
            {docket.staff && ` · ${docket.staff.name}`}
          </div>
        </div>
        <Pill tone={status.tone} showDot>
          {status.label}
        </Pill>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Checks</h4>
          <span className="tabular text-xs text-muted-foreground">
            {coreDone}/{CORE_CHECKS.length}
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CORE_CHECKS.map((c) => (
            <CheckRow key={c.key} label={c.label} checked={checklist[c.key]} onChange={(v) => handleChecklistChange(c.key, v)} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <label className="space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">Temp set (°C)</span>
          <Input
            type="number"
            min="-20"
            max="10"
            value={checklist.tempSetting}
            onChange={(e) => handleChecklistChange('tempSetting', parseInt(e.target.value) || 0)}
            className="h-9"
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">Cable used</span>
          <SegmentedControl
            size="sm"
            value={checklist.cableLengthUsed ?? ('' as CableLength)}
            onChange={(v) => handleChecklistChange('cableLengthUsed', v)}
            options={CABLE_LENGTHS.map((l) => ({ value: l, label: l }))}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Security</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {LOCK_CHECKS.map((c) => (
            <CheckRow key={c.key} label={c.label} checked={checklist[c.key]} onChange={(v) => handleChecklistChange(c.key, v)} />
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-foreground">what3words location</span>
        <div className="flex gap-2">
          <Input value={what3words} onChange={(e) => setWhat3words(e.target.value)} placeholder="///word.word.word" className="h-9" />
          <Button
            type="button"
            variant="outline"
            disabled={!what3words}
            onClick={() => window.open(`https://what3words.com/${what3words.replace(/^\/+/, '')}`, '_blank', 'noopener')}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Open in what3words"
          >
            <ExternalLink />
          </Button>
        </div>
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">
            Customer signature <span className="text-[var(--brand-red)]">*</span>
          </span>
          <button type="button" onClick={clearSignature} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Eraser className="size-3.5" /> Clear
          </button>
        </div>
        <Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Full name of person signing" className="h-9" />
        <div className="overflow-hidden rounded-md border border-dashed bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            className="h-[140px] w-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">Sign above with a finger or mouse</p>
      </div>

      <Button
        onClick={handleComplete}
        disabled={isSubmitting || !signedBy || completed}
        className="h-10 w-full gap-1.5 font-semibold hover:bg-[var(--brand-red-dark)]"
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        {completed ? 'Already completed' : isSubmitting ? 'Completing…' : `Complete ${docket.type === 'DELIVERY' ? 'delivery' : 'collection'}`}
      </Button>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        checked ? 'border-emerald-200 bg-emerald-50/60 text-foreground' : 'bg-white text-foreground hover:bg-muted/40'
      )}
    >
      <span
        className={cn('flex size-4 shrink-0 items-center justify-center rounded border', checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-input')}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
