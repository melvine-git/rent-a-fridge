'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill } from '@/components/ui/status-badge';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { Field, selectClass } from '@/components/app/field';
import { saveServiceableComponent, removeServiceableComponent } from '@/lib/actions';
import { COMPONENT_LABELS } from '@/lib/domain';
import { CircuitBoard, Fan, Gauge, ListChecks, Pencil, Plus, Settings, Thermometer, Trash2, type LucideIcon } from 'lucide-react';
import type { BOMComponent, ServiceableComponent } from '@/types';

const ICONS: Record<BOMComponent['type'], LucideIcon> = {
  COMPRESSOR: Gauge,
  EVAPORATOR: Thermometer,
  CONTROLLER: CircuitBoard,
  FAN_MOTOR: Fan,
  OTHER: Settings,
};

type Draft = { id?: string; type: BOMComponent['type']; name: string; description: string; intervalMonths: string };
const EMPTY: Draft = { type: 'OTHER', name: '', description: '', intervalMonths: '12' };

const interval = (m: number) => (m % 12 === 0 ? `Every ${m / 12 === 1 ? '' : `${m / 12} `}year${m / 12 === 1 ? '' : 's'}` : `Every ${m} month${m === 1 ? '' : 's'}`);

export function ServiceableComponents({ components }: { components: ServiceableComponent[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceableComponent | null>(null);
  const [isSaving, startSave] = useTransition();

  const save = () => {
    if (!draft) return;
    startSave(async () => {
      const result = await saveServiceableComponent({
        id: draft.id,
        type: draft.type,
        name: draft.name,
        description: draft.description,
        intervalMonths: Number(draft.intervalMonths),
      });
      if (result.success) {
        toast.success(draft.id ? 'Component updated' : 'Component added');
        setDraft(null);
        router.refresh();
      } else {
        toast.error('Could not save component', { description: result.error });
      }
    });
  };

  const remove = () => {
    if (!confirmDelete) return;
    startSave(async () => {
      const result = await removeServiceableComponent(confirmDelete.id);
      if (result.success) {
        toast.success(`${confirmDelete.name} removed`);
        setConfirmDelete(null);
        router.refresh();
      } else {
        toast.error('Could not remove component', { description: result.error });
      }
    });
  };

  return (
    <Panel
      title="Serviceable components"
      description="The parts the service team checks, and how often"
      count={components.length}
      action={
        <Button variant="outline" size="sm" onClick={() => setDraft(EMPTY)} className="h-8 gap-1 px-2.5 text-xs">
          <Plus /> Add component
        </Button>
      }
    >
      {components.length === 0 ? (
        <EmptyState compact icon={ListChecks} title="No components listed" description="Add the parts that need regular servicing." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Component</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Scope</th>
                <th className="px-4 py-2.5 font-medium">Interval</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {components.map((c) => {
                const Icon = ICONS[c.type];
                return (
                  <tr key={c.id} className="group">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Icon className="size-4 text-muted-foreground" /> {c.name}
                      </span>
                      <span className="ml-6 text-xs text-muted-foreground">{COMPONENT_LABELS[c.type]}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.description || '—'}</td>
                    <td className="px-4 py-3">
                      <Pill tone="neutral">{interval(c.intervalMonths)}</Pill>
                    </td>
                    <td className="pr-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDraft({ id: c.id, type: c.type, name: c.name, description: c.description ?? '', intervalMonths: String(c.intervalMonths) })}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{draft?.id ? 'Edit component' : 'Add serviceable component'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" required>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Door seals" className="h-9" />
                </Field>
                <Field label="Category">
                  <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as BOMComponent['type'] })} className={selectClass}>
                    {(Object.keys(COMPONENT_LABELS) as BOMComponent['type'][]).map((t) => (
                      <option key={t} value={t}>
                        {COMPONENT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Scope">
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What the service covers" className="h-9" />
              </Field>
              <Field label="Service every (months)" required>
                <Input type="number" min="1" max="120" step="1" value={draft.intervalMonths} onChange={(e) => setDraft({ ...draft, intervalMonths: e.target.value })} className="h-9 w-32" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={save} disabled={isSaving || !draft?.name.trim()} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Remove {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>It will no longer appear in the service schedule. Existing service records are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="h-9 px-4">
              Keep
            </Button>
            <Button onClick={remove} disabled={isSaving} className="h-9 bg-red-600 px-4 hover:bg-red-700">
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
