'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge, Pill } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/app/page-header';
import { Panel } from '@/components/app/panel';
import { DetailItem, DetailList, StatStrip } from '@/components/app/detail';
import { EmptyState } from '@/components/app/empty-state';
import { TabBar } from '@/components/app/tab-bar';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UnitTypeIcon } from '@/components/app/unit-type-icon';
import { updateUnit, updateUnitSpecifications, addBOMComponent, removeBOMComponent, addMaintenanceRecord, setUnitStatus } from '@/lib/actions';
import { COMPONENT_LABELS, GBP, POWER_LABELS, RECORD_TYPE_META, STATUS_META, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS } from '@/lib/domain';
import { daysBetween, daysFromToday, formatDate, toISODate } from '@/lib/format';
import { Activity, ArrowUpRight, CalendarDays, Cpu, Pencil, Plus, Ruler, Trash2, Wrench } from 'lucide-react';
import type { Unit, Booking, Customer, BOMComponent, MaintenanceRecord, UnitType, UnitSize, PowerType, UnitStatus } from '@/types';

type BookingWithCustomer = Booking & { customer: Customer };

interface Props {
  unit: Unit;
  bookingHistory: BookingWithCustomer[];
  currentBooking: BookingWithCustomer | null;
}

type Tab = 'overview' | 'bom' | 'bookings' | 'maintenance';

const dims = (d?: { length: number; width: number; height: number }) =>
  d ? `${d.length.toLocaleString()} × ${d.width.toLocaleString()} × ${d.height.toLocaleString()} mm` : undefined;

export function UnitDetailView({ unit, bookingHistory, currentBooking }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showSpecsEdit, setShowSpecsEdit] = useState(false);
  const [showAddBOM, setShowAddBOM] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);

  const [editForm, setEditForm] = useState({ size: unit.size, powerType: unit.powerType, unitType: unit.unitType, notes: unit.notes || '' });
  const s = unit.specifications;
  const [specsForm, setSpecsForm] = useState({
    extLength: s?.externalDimensions?.length?.toString() || '',
    extWidth: s?.externalDimensions?.width?.toString() || '',
    extHeight: s?.externalDimensions?.height?.toString() || '',
    intLength: s?.internalDimensions?.length?.toString() || '',
    intWidth: s?.internalDimensions?.width?.toString() || '',
    intHeight: s?.internalDimensions?.height?.toString() || '',
    cubicCapacity: s?.cubicCapacity?.toString() || '',
    doorAccess: s?.doorAccess || '',
    chassisNumber: s?.chassisNumber || '',
  });
  const [bomForm, setBomForm] = useState({ type: 'OTHER' as BOMComponent['type'], name: '', manufacturer: '', model: '', serialNumber: '', installedDate: '' });
  const [maintForm, setMaintForm] = useState({ type: 'SCHEDULED' as MaintenanceRecord['type'], description: '', performedBy: '', cost: '', nextServiceDate: '' });

  const done = (msg: string) => {
    toast.success(msg);
    router.refresh();
  };

  const handleSaveEdit = async () => {
    const r = await updateUnit(unit.id, editForm);
    if (r.success) {
      setIsEditing(false);
      done('Unit updated');
    } else toast.error(r.error || 'Failed to update');
  };

  const handleSaveSpecs = async () => {
    const n = (v: string) => (v ? parseInt(v) : 0);
    const r = await updateUnitSpecifications(unit.id, {
      externalDimensions: specsForm.extLength ? { length: n(specsForm.extLength), width: n(specsForm.extWidth), height: n(specsForm.extHeight) } : undefined,
      internalDimensions: specsForm.intLength ? { length: n(specsForm.intLength), width: n(specsForm.intWidth), height: n(specsForm.intHeight) } : undefined,
      cubicCapacity: specsForm.cubicCapacity ? parseFloat(specsForm.cubicCapacity) : undefined,
      doorAccess: specsForm.doorAccess || undefined,
      chassisNumber: specsForm.chassisNumber || undefined,
    });
    if (r.success) {
      setShowSpecsEdit(false);
      done('Specifications updated');
    }
  };

  const handleAddBOM = async () => {
    if (!bomForm.name) {
      toast.error('Enter a component name');
      return;
    }
    const r = await addBOMComponent(unit.id, bomForm);
    if (r.success) {
      setShowAddBOM(false);
      setBomForm({ type: 'OTHER', name: '', manufacturer: '', model: '', serialNumber: '', installedDate: '' });
      done('Component added');
    }
  };

  const handleRemoveBOM = async (id: string) => {
    const r = await removeBOMComponent(unit.id, id);
    if (r.success) done('Component removed');
  };

  const handleAddMaintenance = async () => {
    if (!maintForm.description) {
      toast.error('Describe the work carried out');
      return;
    }
    const r = await addMaintenanceRecord(unit.id, {
      date: toISODate(new Date()),
      type: maintForm.type,
      description: maintForm.description,
      performedBy: maintForm.performedBy,
      cost: maintForm.cost ? parseFloat(maintForm.cost) : undefined,
      nextServiceDate: maintForm.nextServiceDate || undefined,
    });
    if (r.success) {
      setShowAddMaintenance(false);
      setMaintForm({ type: 'SCHEDULED', description: '', performedBy: '', cost: '', nextServiceDate: '' });
      done('Service record added');
    }
  };

  const handleSetStatus = async (status: UnitStatus) => {
    const r = await setUnitStatus(unit.id, status);
    if (r.success) done(`Status set to ${STATUS_META[status].label.toLowerCase()}`);
  };

  const history = unit.maintenanceHistory ?? [];
  const nextService = history.map((r) => r.nextServiceDate).filter((d): d is string => !!d).sort().at(-1);
  const serviceDays = nextService ? daysFromToday(nextService) : undefined;
  const hireDays = bookingHistory.reduce((sum, b) => sum + daysBetween(b.startDate, b.endDate), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Fleet', href: '/units' }, { label: unit.id }]}
        title={
          <span className="flex items-center gap-3">
            <UnitTypeIcon type={unit.unitType} boxed className="size-11" />
            <span className="font-mono-unit text-2xl">{unit.id}</span>
          </span>
        }
        meta={<StatusBadge status={unit.status} />}
        description={`${UNIT_TYPE_LABELS[unit.unitType]} · ${UNIT_SIZE_LABELS[unit.size]} · ${POWER_LABELS[unit.powerType]}`}
        actions={
          <>
            <select
              value={unit.status}
              onChange={(e) => handleSetStatus(e.target.value as UnitStatus)}
              className={`${selectClass} w-auto font-medium`}
              aria-label="Change status"
            >
              <option value="AVAILABLE">Available</option>
              <option value="ON_HIRE">On hire</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            <Button variant="outline" onClick={() => setIsEditing(true)} className="h-9 gap-1.5 px-3">
              <Pencil /> Edit
            </Button>
          </>
        }
      />

      {currentBooking && (
        <Link
          href={`/bookings/${currentBooking.id}`}
          className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50/60 px-4 py-3 hover:bg-sky-50"
        >
          <span className="size-2 rounded-full bg-sky-500" />
          <div className="min-w-0 flex-1 text-sm">
            <span className="font-semibold text-sky-950">On hire to {currentBooking.customer.name}</span>
            <span className="text-sky-900/70">
              {' '}
              · {formatDate(currentBooking.startDate)} – {formatDate(currentBooking.endDate)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-800">
            View booking <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <StatStrip
        items={[
          { label: 'Total hires', value: bookingHistory.length, sub: `${hireDays} days on hire` },
          {
            label: 'Next service',
            value: nextService ? formatDate(nextService) : 'Not scheduled',
            sub:
              serviceDays === undefined ? 'Log a service to set a reminder' : serviceDays < 0 ? <span className="font-medium text-red-600">{-serviceDays} days overdue</span> : `in ${serviceDays} days`,
          },
          { label: 'Capacity', value: s?.cubicCapacity ? `${s.cubicCapacity} m³` : '—', sub: s?.doorAccess || 'Door access not set' },
          { label: 'Data logger', value: unit.dataLoggerId ? 'Connected' : 'None', sub: unit.dataLoggerId ? <span className="font-mono">{unit.dataLoggerId}</span> : 'Not configured' },
        ]}
      />

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Specifications' },
          { value: 'bom', label: 'Components', count: unit.bom?.length ?? 0 },
          { value: 'bookings', label: 'Hire history', count: bookingHistory.length },
          { value: 'maintenance', label: 'Service history', count: history.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <Panel
            title="Specifications"
            className="lg:col-span-2"
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowSpecsEdit(true)} className="h-7 gap-1 px-2 text-xs">
                <Pencil /> Edit
              </Button>
            }
          >
            {s ? (
              <DetailList cols={2}>
                <DetailItem label="External dimensions (L × W × H)">{dims(s.externalDimensions) ?? <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Internal dimensions (L × W × H)">{dims(s.internalDimensions) ?? <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Cubic capacity">{s.cubicCapacity ? `${s.cubicCapacity} m³` : <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Door access">{s.doorAccess || <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Chassis number">
                  {s.chassisNumber ? <span className="font-mono">{s.chassisNumber}</span> : <span className="text-muted-foreground">Not specified</span>}
                </DetailItem>
                <DetailItem label="Photos">{s.photoUrls?.length ? `${s.photoUrls.length} photos` : <span className="text-muted-foreground">None uploaded</span>}</DetailItem>
              </DetailList>
            ) : (
              <EmptyState
                compact
                icon={Ruler}
                title="No specifications yet"
                description="Add dimensions and capacity so the team can match this unit to customer requirements."
                action={
                  <Button variant="outline" onClick={() => setShowSpecsEdit(true)}>
                    Add specifications
                  </Button>
                }
              />
            )}
          </Panel>
          <Panel title="Configuration">
            <DetailList>
              <DetailItem label="Unit type">{UNIT_TYPE_LABELS[unit.unitType]}</DetailItem>
              <DetailItem label="Size">{UNIT_SIZE_LABELS[unit.size]}</DetailItem>
              <DetailItem label="Power">{POWER_LABELS[unit.powerType]}</DetailItem>
              <DetailItem label="Notes">{unit.notes || <span className="text-muted-foreground">No notes</span>}</DetailItem>
            </DetailList>
          </Panel>
        </div>
      )}

      {tab === 'bom' && (
        <Panel
          title="Bill of materials"
          action={
            <Button variant="outline" size="sm" onClick={() => setShowAddBOM(true)} className="h-8 gap-1 px-2.5 text-xs">
              <Plus /> Add component
            </Button>
          }
        >
          {unit.bom?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Component</th>
                    <th className="px-4 py-2.5 font-medium">Manufacturer / model</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Serial no.</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Installed</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unit.bom.map((c) => (
                    <tr key={c.id} className="group">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{COMPONENT_LABELS[c.type]}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{[c.manufacturer, c.model].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">{c.serialNumber || '—'}</td>
                      <td className="tabular hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(c.installedDate, { year: true })}</td>
                      <td className="pr-3 text-right">
                        <button
                          onClick={() => handleRemoveBOM(c.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label={`Remove ${c.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState compact icon={Cpu} title="No components recorded" description="Track compressors, controllers and other serviceable parts." />
          )}
        </Panel>
      )}

      {tab === 'bookings' && (
        <Panel title="Hire history" count={bookingHistory.length}>
          {bookingHistory.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Hire period</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Site</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookingHistory.map((b) => (
                    <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)} className="cursor-pointer hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{b.customer.name}</div>
                        <div className="font-mono-unit text-[11px] text-muted-foreground">{b.id}</div>
                      </td>
                      <td className="tabular px-4 py-3 whitespace-nowrap">
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                        <div className="text-xs text-muted-foreground">{daysBetween(b.startDate, b.endDate)} days</div>
                      </td>
                      <td className="hidden max-w-[260px] truncate px-4 py-3 text-muted-foreground md:table-cell">{b.deliveryAddress}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState compact icon={CalendarDays} title="Never hired" description="This unit has no bookings yet." />
          )}
        </Panel>
      )}

      {tab === 'maintenance' && (
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <Panel
            title="Service history"
            className="lg:col-span-2"
            action={
              <Button variant="outline" size="sm" onClick={() => setShowAddMaintenance(true)} className="h-8 gap-1 px-2.5 text-xs">
                <Plus /> Log service
              </Button>
            }
          >
            {history.length ? (
              <ul className="divide-y">
                {history.map((r) => (
                  <li key={r.id} className="flex gap-4 px-4 py-3">
                    <div className="tabular w-20 shrink-0 text-xs text-muted-foreground">{formatDate(r.date, { year: true })}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                        {r.performedBy && <span className="text-xs text-muted-foreground">by {r.performedBy}</span>}
                      </div>
                      <p className="mt-1 text-sm text-foreground">{r.description}</p>
                      {r.partsReplaced?.length ? <p className="mt-0.5 text-xs text-muted-foreground">Parts: {r.partsReplaced.join(', ')}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {r.cost ? <div className="tabular text-sm font-medium text-foreground">{GBP.format(r.cost)}</div> : null}
                      {r.nextServiceDate && <div className="text-xs text-muted-foreground">Next {formatDate(r.nextServiceDate)}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Wrench} title="No service records" />
            )}
          </Panel>
          <Panel title="Data logger">
            <div className="flex items-center gap-3 p-4">
              <Activity className={unit.dataLoggerId ? 'size-5 text-emerald-600' : 'size-5 text-muted-foreground/50'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{unit.dataLoggerId ? 'Logger connected' : 'No logger'}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{unit.dataLoggerId || 'Not configured'}</div>
              </div>
            </div>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">Integration with the external data logger platform is pending configuration.</p>
          </Panel>
        </div>
      )}

      {/* Edit unit */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit {unit.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Unit type">
              <select value={editForm.unitType} onChange={(e) => setEditForm((p) => ({ ...p, unitType: e.target.value as UnitType }))} className={selectClass}>
                {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                  <option key={t} value={t}>
                    {UNIT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Size">
                <select value={editForm.size} onChange={(e) => setEditForm((p) => ({ ...p, size: e.target.value as UnitSize }))} className={selectClass}>
                  {(Object.keys(UNIT_SIZE_LABELS) as UnitSize[]).map((v) => (
                    <option key={v} value={v}>
                      {UNIT_SIZE_LABELS[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Power">
                <select value={editForm.powerType} onChange={(e) => setEditForm((p) => ({ ...p, powerType: e.target.value as PowerType }))} className={selectClass}>
                  {(Object.keys(POWER_LABELS) as PowerType[]).map((v) => (
                    <option key={v} value={v}>
                      {POWER_LABELS[v]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} className={textareaClass} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specs */}
      <Dialog open={showSpecsEdit} onOpenChange={setShowSpecsEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Specifications</DialogTitle>
            <DialogDescription>Dimensions in millimetres.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(
              [
                ['External (L × W × H)', 'extLength', 'extWidth', 'extHeight'],
                ['Internal (L × W × H)', 'intLength', 'intWidth', 'intHeight'],
              ] as const
            ).map(([label, l, w, h]) => (
              <div key={label} className="space-y-1.5">
                <span className="text-[13px] font-medium text-foreground">{label}</span>
                <div className="grid grid-cols-3 gap-2">
                  {[l, w, h].map((k, i) => (
                    <Input
                      key={k}
                      type="number"
                      placeholder={['Length', 'Width', 'Height'][i]}
                      value={specsForm[k]}
                      onChange={(e) => setSpecsForm((p) => ({ ...p, [k]: e.target.value }))}
                      className="h-9"
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cubic capacity (m³)">
                <Input type="number" step="0.1" value={specsForm.cubicCapacity} onChange={(e) => setSpecsForm((p) => ({ ...p, cubicCapacity: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Door access">
                <Input value={specsForm.doorAccess} onChange={(e) => setSpecsForm((p) => ({ ...p, doorAccess: e.target.value }))} placeholder="e.g. Rear doors" className="h-9" />
              </Field>
            </div>
            <Field label="Chassis number">
              <Input value={specsForm.chassisNumber} onChange={(e) => setSpecsForm((p) => ({ ...p, chassisNumber: e.target.value }))} className="h-9 font-mono" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSpecsEdit(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSaveSpecs} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save specifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM */}
      <Dialog open={showAddBOM} onOpenChange={setShowAddBOM}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select value={bomForm.type} onChange={(e) => setBomForm((p) => ({ ...p, type: e.target.value as BOMComponent['type'] }))} className={selectClass}>
                  {(Object.keys(COMPONENT_LABELS) as BOMComponent['type'][]).map((t) => (
                    <option key={t} value={t}>
                      {COMPONENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name" required>
                <Input value={bomForm.name} onChange={(e) => setBomForm((p) => ({ ...p, name: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Manufacturer">
                <Input value={bomForm.manufacturer} onChange={(e) => setBomForm((p) => ({ ...p, manufacturer: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Model">
                <Input value={bomForm.model} onChange={(e) => setBomForm((p) => ({ ...p, model: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Serial number">
                <Input value={bomForm.serialNumber} onChange={(e) => setBomForm((p) => ({ ...p, serialNumber: e.target.value }))} className="h-9 font-mono" />
              </Field>
              <Field label="Installed">
                <Input type="date" value={bomForm.installedDate} onChange={(e) => setBomForm((p) => ({ ...p, installedDate: e.target.value }))} className="h-9" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBOM(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleAddBOM} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Add component
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance */}
      <Dialog open={showAddMaintenance} onOpenChange={setShowAddMaintenance}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Log service for {unit.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Type">
              <select value={maintForm.type} onChange={(e) => setMaintForm((p) => ({ ...p, type: e.target.value as MaintenanceRecord['type'] }))} className={selectClass}>
                <option value="SCHEDULED">Scheduled service</option>
                <option value="REPAIR">Repair</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </Field>
            <Field label="Work carried out" required>
              <textarea value={maintForm.description} onChange={(e) => setMaintForm((p) => ({ ...p, description: e.target.value }))} className={textareaClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Technician">
                <Input value={maintForm.performedBy} onChange={(e) => setMaintForm((p) => ({ ...p, performedBy: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Cost (£)">
                <Input type="number" min="0" step="0.01" value={maintForm.cost} onChange={(e) => setMaintForm((p) => ({ ...p, cost: e.target.value }))} className="h-9" />
              </Field>
            </div>
            <Field label="Next service date">
              <Input type="date" value={maintForm.nextServiceDate} onChange={(e) => setMaintForm((p) => ({ ...p, nextServiceDate: e.target.value }))} className="h-9" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMaintenance(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleAddMaintenance} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
