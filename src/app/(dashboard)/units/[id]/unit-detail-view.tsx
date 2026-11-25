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
import { UnitPhotos } from './unit-photos';
import { ServiceRecordDialog, AttachmentLinks } from '@/components/maintenance/service-record-dialog';
import { updateUnit, updateUnitSpecifications, addBOMComponent, updateBOMComponent, removeBOMComponent, setUnitStatus, setUnitBreakdown, setUnitNextService, deleteUnit } from '@/lib/actions';
import { COMPONENT_LABELS, GBP, RECORD_TYPE_META, STATUS_META, UNIT_SIZE_LABELS, UNIT_TYPE_LABELS, nextServiceDate, unitDisplayStatus } from '@/lib/domain';
import { daysBetween, daysFromToday, formatCapacity, formatDate, formatDimensions } from '@/lib/format';
import { ArrowUpRight, CalendarClock, CalendarDays, Cpu, Pencil, Plus, Ruler, Trash2, TriangleAlert, Wrench } from 'lucide-react';
import type { Unit, Booking, Customer, BOMComponent, CapacityUnit, DimensionUnit, MaintenanceRecord, UnitType, UnitSize, UnitStatus } from '@/types';

type BookingWithCustomer = Booking & { customer: Customer };

interface Props {
  unit: Unit;
  bookingHistory: BookingWithCustomer[];
  currentBooking: BookingWithCustomer | null;
  allUnits: Unit[];
}

export type UnitTab = 'overview' | 'bom' | 'bookings' | 'maintenance';
type Tab = UnitTab;



export function UnitDetailView({ unit, bookingHistory, currentBooking, allUnits, initialTab }: Props & { initialTab?: UnitTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showSpecsEdit, setShowSpecsEdit] = useState(false);
  const [showAddBOM, setShowAddBOM] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BOMComponent | null>(null);
  const [serviceDialog, setServiceDialog] = useState<{ key: number; record?: MaintenanceRecord } | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownNotes, setBreakdownNotes] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const [editForm, setEditForm] = useState({
    size: unit.size,
    unitType: unit.unitType,
    notes: unit.notes || '',
  });
  const s = unit.specifications;
  // Rows saved before units existed are millimetres — open the form in centimetres
  const dimInput = (v?: number) => (v == null ? '' : String(s?.dimensionUnit ? v : v / 10));
  const [specsForm, setSpecsForm] = useState({
    extLength: dimInput(s?.externalDimensions?.length),
    extWidth: dimInput(s?.externalDimensions?.width),
    extHeight: dimInput(s?.externalDimensions?.height),
    intLength: dimInput(s?.internalDimensions?.length),
    intWidth: dimInput(s?.internalDimensions?.width),
    intHeight: dimInput(s?.internalDimensions?.height),
    dimensionUnit: s?.dimensionUnit ?? ('CM' as DimensionUnit),
    cubicCapacity: s?.cubicCapacity?.toString() || '',
    capacityUnit: s?.capacityUnit ?? ((s?.cubicCapacity ?? 1) < 1 ? 'L' : 'M3'),
    doorAccess: s?.doorAccess || '',
    chassisNumber: s?.chassisNumber || '',
  });
  const emptyBomForm = { type: 'OTHER' as BOMComponent['type'], name: '', manufacturer: '', model: '', serialNumber: '', installedDate: '', warrantyExpiry: '', refrigerantCharge: '', notes: '' };
  const [bomForm, setBomForm] = useState(emptyBomForm);
  const openAddBOM = () => {
    setEditingBOM(null);
    setBomForm(emptyBomForm);
    setShowAddBOM(true);
  };
  const openEditBOM = (c: BOMComponent) => {
    setEditingBOM(c);
    setBomForm({
      type: c.type,
      name: c.name,
      manufacturer: c.manufacturer ?? '',
      model: c.model ?? '',
      serialNumber: c.serialNumber ?? '',
      installedDate: c.installedDate ?? '',
      warrantyExpiry: c.warrantyExpiry ?? '',
      refrigerantCharge: c.refrigerantCharge ?? '',
      notes: c.notes ?? '',
    });
    setShowAddBOM(true);
  };
  const done = (msg: string) => {
    toast.success(msg);
    router.refresh();
  };
  const failed = (r: { error?: string }) => toast.error('Could not save', { description: r.error ?? 'Please try again' });

  const handleSaveEdit = async () => {
    const r = await updateUnit(unit.id, { ...editForm, notes: editForm.notes.trim() });
    if (r.success) {
      setIsEditing(false);
      done('Unit updated');
    } else toast.error(r.error || 'Failed to update');
  };

  const handleSaveSpecs = async () => {
    const n = (v: string) => (v ? parseFloat(v) : 0);
    const r = await updateUnitSpecifications(unit.id, {
      externalDimensions: specsForm.extLength ? { length: n(specsForm.extLength), width: n(specsForm.extWidth), height: n(specsForm.extHeight) } : undefined,
      internalDimensions: specsForm.intLength ? { length: n(specsForm.intLength), width: n(specsForm.intWidth), height: n(specsForm.intHeight) } : undefined,
      dimensionUnit: specsForm.extLength || specsForm.intLength ? specsForm.dimensionUnit : undefined,
      cubicCapacity: specsForm.cubicCapacity ? parseFloat(specsForm.cubicCapacity) : undefined,
      capacityUnit: specsForm.cubicCapacity ? (specsForm.capacityUnit as CapacityUnit) : undefined,
      doorAccess: specsForm.doorAccess || undefined,
      chassisNumber: specsForm.chassisNumber || undefined,
    });
    if (r.success) {
      setShowSpecsEdit(false);
      done('Specifications updated');
    } else failed(r);
  };

  const handleSaveBOM = async () => {
    if (!bomForm.name.trim()) {
      toast.error('Enter a component name');
      return;
    }
    const clean = Object.fromEntries(Object.entries(bomForm).map(([k, v]) => [k, v.trim() || undefined])) as typeof bomForm;
    const payload = { ...clean, type: bomForm.type, name: bomForm.name.trim(), refrigerantCharge: bomForm.type === 'REFRIGERANT' ? clean.refrigerantCharge : undefined };
    const r = await (editingBOM
      ? updateBOMComponent(unit.id, editingBOM.id, payload)
      : addBOMComponent(unit.id, payload)
    ).catch(() => ({ success: false, error: 'Connection problem, please try again' }));
    if (r.success) {
      setShowAddBOM(false);
      setEditingBOM(null);
      setBomForm(emptyBomForm);
      done(editingBOM ? 'Component updated' : 'Component added');
    } else failed(r);
  };

  const handleRemoveBOM = async (id: string) => {
    const r = await removeBOMComponent(unit.id, id);
    if (r.success) done('Component removed');
    else failed(r);
  };

  const handleStatusChange = async (value: string) => {
    if (value === 'BREAKDOWN') {
      setBreakdownNotes(unit.breakdown?.notes ?? '');
      setBreakdownOpen(true);
      return;
    }
    const status = value as UnitStatus;
    // Choosing a real status while broken down implies the unit is back in service
    if (unit.breakdown) {
      const fix = await setUnitBreakdown(unit.id, null);
      if (!fix.success) {
        failed(fix);
        return;
      }
    }
    const r = await setUnitStatus(unit.id, status);
    if (r.success) done(`Status set to ${STATUS_META[status].label.toLowerCase()}`);
    else failed(r);
  };

  const saveBreakdown = async (notes: string | null) => {
    const r = await setUnitBreakdown(unit.id, notes);
    if (r.success) {
      setBreakdownOpen(false);
      done(notes === null ? `${unit.id} marked as fixed` : `${unit.id} marked as broken down`);
    } else failed(r);
  };

  const saveSchedule = async (date: string | null) => {
    const r = await setUnitNextService(unit.id, date);
    if (r.success) {
      setScheduleOpen(false);
      done(date ? `Next service set for ${formatDate(date, { year: true })}` : 'Scheduled service cleared');
    } else failed(r);
  };

  const handleDeleteUnit = async () => {
    const r = await deleteUnit(unit.id);
    if (r.success) {
      toast.success(`${unit.id} deleted`);
      router.push('/units');
      router.refresh();
    } else {
      setDeleteOpen(false);
      failed(r);
    }
  };

  const history = unit.maintenanceHistory ?? [];
  const nextService = nextServiceDate(unit);
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
        meta={<StatusBadge status={unitDisplayStatus(unit)} />}
        description={`${UNIT_TYPE_LABELS[unit.unitType]} · ${UNIT_SIZE_LABELS[unit.size]}`}
        actions={
          <>
            <select
              value={unit.breakdown ? 'BREAKDOWN' : unit.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`${selectClass.replace('w-full', 'w-auto')} font-medium`}
              aria-label="Change status"
            >
              <option value="AVAILABLE">Available</option>
              <option value="ON_HIRE" disabled={unit.status !== 'ON_HIRE'}>
                On hire
              </option>
              <option value="MAINTENANCE">In maintenance</option>
              <option value="BREAKDOWN" className="text-red-700">
                Broken down
              </option>
            </select>
            <Button variant="outline" onClick={() => setIsEditing(true)} className="h-9 gap-1.5 px-3">
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)} className="h-9 gap-1.5 px-3 text-red-700 hover:bg-red-50">
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      {unit.breakdown && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 sm:flex-row sm:items-center">
          <TriangleAlert className="size-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-red-900">
              Broken down{unit.status === 'ON_HIRE' ? ' while on hire' : ''} · reported {formatDate(unit.breakdown.reportedAt.split('T')[0], { year: true })}
            </div>
            <div className="text-red-800/80">{unit.breakdown.notes || 'No details recorded'}. New bookings are blocked until it is fixed.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setServiceDialog({ key: Date.now() })} className="h-9 bg-white px-3">
              Log repair
            </Button>
            <Button onClick={() => saveBreakdown(null)} className="h-9 bg-emerald-600 px-3 hover:bg-emerald-700">
              Mark fixed
            </Button>
          </div>
        </div>
      )}

      {currentBooking && (
        <Link
          href={`/bookings/${currentBooking.id}`}
          className="group flex items-center gap-4 rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 hover:bg-sky-50"
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
            value: (
              <button
                type="button"
                onClick={() => {
                  setScheduleDate(nextService ?? '');
                  setScheduleOpen(true);
                }}
                className="inline-flex items-center gap-1.5 hover:underline"
                title="Change the next service date"
              >
                {nextService ? formatDate(nextService) : 'Not scheduled'}
                <Pencil className="size-3.5 text-muted-foreground" />
              </button>
            ),
            sub:
              serviceDays === undefined ? 'Click to schedule' : serviceDays < 0 ? <span className="font-medium text-red-600">{-serviceDays} days overdue</span> : `in ${serviceDays} days`,
          },
          { label: 'Capacity', value: formatCapacity(s) ?? '—', sub: s?.doorAccess || 'Door access not set' },
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
                <DetailItem label="External dimensions (L × W × H)">{formatDimensions(s.externalDimensions, s.dimensionUnit) ?? <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Internal dimensions (L × W × H)">{formatDimensions(s.internalDimensions, s.dimensionUnit) ?? <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Capacity">{formatCapacity(s) ?? <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Door access">{s.doorAccess || <span className="text-muted-foreground">Not specified</span>}</DetailItem>
                <DetailItem label="Chassis number">
                  {s.chassisNumber ? <span className="font-mono">{s.chassisNumber}</span> : <span className="text-muted-foreground">Not specified</span>}
                </DetailItem>
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
              <DetailItem label="Notes">{unit.notes || <span className="text-muted-foreground">No notes</span>}</DetailItem>
            </DetailList>
          </Panel>
          <div className="lg:col-span-3">
            <UnitPhotos unitId={unit.id} photos={s?.photoUrls ?? []} />
          </div>
        </div>
      )}

      {tab === 'bom' && (
        <Panel
          title="Bill of materials"
          action={
            <Button variant="outline" size="sm" onClick={openAddBOM} className="h-8 gap-1 px-2.5 text-xs">
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
                        <div className="text-xs text-muted-foreground">{COMPONENT_LABELS[c.type]}{c.refrigerantCharge ? ` · ${c.refrigerantCharge}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{[c.manufacturer, c.model].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">{c.serialNumber || '—'}</td>
                      <td className="tabular hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(c.installedDate, { year: true })}</td>
                      <td className="pr-3 flex items-center gap-2 justify-center mt-3">
                        <button
                          onClick={() => openEditBOM(c)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-60 hover:bg-muted
                            hover:text-foreground group-hover:opacity-100"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveBOM(c.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-60 hover:bg-red-50
                            hover:text-red-600 group-hover:opacity-100"
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
                      <td className="hidden max-w-65 truncate px-4 py-3 text-muted-foreground md:table-cell">{b.deliveryAddress}</td>
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
        <div>
          <Panel
            title="Service history"
            description="Click a record to edit, move or delete it"
            action={
              <Button variant="outline" size="sm" onClick={() => setServiceDialog({ key: Date.now() })} className="h-8 gap-1 px-2.5 text-xs">
                <Plus /> Log service
              </Button>
            }
          >
            {history.length ? (
              <ul className="divide-y">
                {history.map((r) => (
                  <li key={r.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setServiceDialog({ key: Date.now(), record: r })}
                      onKeyDown={(e) => e.key === 'Enter' && setServiceDialog({ key: Date.now(), record: r })}
                      className="flex cursor-pointer gap-4 px-4 py-3 hover:bg-muted/40"
                      title="Edit record or attach documents"
                    >
                      <div className="tabular w-20 shrink-0 text-xs text-muted-foreground">{formatDate(r.date, { year: true })}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                          {r.performedBy && <span className="text-xs text-muted-foreground">by {r.performedBy}</span>}
                          {r.hoursWorked !== undefined && <span className="text-xs text-muted-foreground">· {r.hoursWorked}h</span>}
                        </div>
                        <p className="mt-1 text-sm text-foreground">{r.description}</p>
                        {r.partsReplaced?.length ? <p className="mt-0.5 text-xs text-muted-foreground">Parts: {r.partsReplaced.join(', ')}</p> : null}
                        {r.orderNumbers?.length ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            Order nos.
                            {r.orderNumbers.map((o) => (
                              <span key={o} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {o}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {!!r.attachments?.length && (
                          <div className="mt-1.5">
                            <AttachmentLinks files={r.attachments} />
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {r.cost ? <div className="tabular text-sm font-medium text-foreground">{GBP.format(r.cost)}</div> : null}
                        {r.nextServiceDate && <div className="text-xs text-muted-foreground">Next {formatDate(r.nextServiceDate)}</div>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Wrench} title="No service records" />
            )}
          </Panel>
        </div>
      )}

      {/* Edit unit */}
     
<Dialog open={isEditing} onOpenChange={setIsEditing}>
  <DialogContent className="sm:max-w-120 overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl">
    <DialogHeader className="border-b border-gray-100 bg-gray-50/80 px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-(--brand-red)">
          <Pencil className="h-5 w-5" />
        </div>

        <div className="space-y-1">
          <DialogTitle className="text-base font-semibold text-gray-900">
            Edit unit
          </DialogTitle>
          <p className="text-xs text-gray-500">
            Update the configuration and details for{" "}
            <span className="font-medium text-gray-700">{unit.id}</span>
          </p>
        </div>
      </div>
    </DialogHeader>

    <div className="space-y-5 px-6 py-6">
      <Field label="Unit type">
        <select
          value={editForm.unitType}
          onChange={(e) =>
            setEditForm((p) => ({
              ...p,
              unitType: e.target.value as UnitType,
            }))
          }
          className={`${selectClass} h-10 rounded-lg border-gray-200 bg-gray-50/50 text-sm transition focus:border-(--brand-red) focus:bg-white focus:ring-2 focus:ring-(--brand-red)/10`}
        >
          {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
            <option key={t} value={t}>
              {UNIT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Size">
        <select
          value={editForm.size}
          onChange={(e) =>
            setEditForm((p) => ({
              ...p,
              size: e.target.value as UnitSize,
            }))
          }
          className={`${selectClass} h-10 rounded-lg border-gray-200 bg-gray-50/50 text-sm transition focus:border-(--brand-red) focus:bg-white focus:ring-2 focus:ring-(--brand-red)/10`}
        >
          {(Object.keys(UNIT_SIZE_LABELS) as UnitSize[]).map((v) => (
            <option key={v} value={v}>
              {UNIT_SIZE_LABELS[v]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" hint="Add any additional information about this unit.">
        <textarea
          value={editForm.notes}
          onChange={(e) =>
            setEditForm((p) => ({
              ...p,
              notes: e.target.value,
            }))
          }
          placeholder="Enter notes here..."
          rows={4}
          className={`${textareaClass} min-h-25 rounded-lg border-gray-200 bg-gray-50/50 text-sm transition placeholder:text-gray-400 focus:border-(--brand-red) focus:bg-white focus:ring-2 focus:ring-(--brand-red)/10`}
        />
      </Field>
    </div>

    <DialogFooter className="flex-row justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
      <Button
        variant="outline"
        onClick={() => setIsEditing(false)}
        className="h-9 rounded-lg border-gray-200 bg-white px-4 text-sm font-medium hover:bg-gray-100"
      >
        Cancel
      </Button>

      <Button
        onClick={handleSaveEdit}
        className="h-9 rounded-lg bg-(--brand-red) px-5 text-sm font-medium text-white shadow-sm transition hover:bg-(--brand-red-dark)"
      >
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
            <DialogDescription>Dimensions in centimetres or metres.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-foreground">Dimensions</span>
              <select value={specsForm.dimensionUnit} onChange={(e) => setSpecsForm((p) => ({ ...p, dimensionUnit: e.target.value as DimensionUnit }))} className={selectClass}>
                <option value="CM">centimetres (cm)</option>
                <option value="M">metres (m)</option>
              </select>
            </div>
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
                      step="any"
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
              <Field label="Capacity">
                <div className="grid grid-cols-[1fr_104px] gap-2">
                  <Input type="number" step="0.1" value={specsForm.cubicCapacity} onChange={(e) => setSpecsForm((p) => ({ ...p, cubicCapacity: e.target.value }))} className="h-9" />
                  <select value={specsForm.capacityUnit} onChange={(e) => setSpecsForm((p) => ({ ...p, capacityUnit: e.target.value as CapacityUnit }))} className={selectClass}>
                    <option value="M3">m³</option>
                    <option value="M2">m²</option>
                    <option value="L">Litres</option>
                  </select>
                </div>
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
            <Button onClick={handleSaveSpecs} className="h-9 px-4 hover:bg-(--brand-red-dark)">
              Save specifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM */}
      <Dialog open={showAddBOM} onOpenChange={setShowAddBOM}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editingBOM ? 'Edit component' : 'Add component'}</DialogTitle>
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
              <Field label="Warranty expiry">
                <Input type="date" value={bomForm.warrantyExpiry} onChange={(e) => setBomForm((p) => ({ ...p, warrantyExpiry: e.target.value }))} className="h-9" />
              </Field>
              {bomForm.type === 'REFRIGERANT' && (
                <Field label="Charge">
                  <Input value={bomForm.refrigerantCharge} onChange={(e) => setBomForm((p) => ({ ...p, refrigerantCharge: e.target.value }))} placeholder="e.g. 80g" className="h-9" />
                </Field>
              )}
            </div>
            <Field label="Notes">
              <textarea value={bomForm.notes} onChange={(e) => setBomForm((p) => ({ ...p, notes: e.target.value }))} className={textareaClass} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBOM(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSaveBOM} className="h-9 px-4 hover:bg-(--brand-red-dark)">
              {editingBOM ? 'Save changes' : 'Add component'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete unit */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete {unit.id}?</DialogTitle>
            <DialogDescription>
              This permanently removes the unit, its specifications, components and service history. Units with bookings cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleDeleteUnit} className="h-9 bg-red-600 px-4 hover:bg-red-700">
              Delete unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service record */}
      {serviceDialog && (
        <ServiceRecordDialog
          key={serviceDialog.key}
          open
          onOpenChange={(o) => !o && setServiceDialog(null)}
          units={allUnits}
          unitId={unit.id}
          record={serviceDialog.record}
          onSaved={() => {
            setServiceDialog(null);
            router.refresh();
          }}
        />
      )}

      {/* Breakdown */}
      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Mark {unit.id} as broken down</DialogTitle>
            <DialogDescription>
              {unit.status === 'ON_HIRE'
                ? 'The hire stays open so the unit can be repaired on site or swapped. New bookings are blocked until it is marked fixed.'
                : 'New bookings are blocked until it is marked fixed.'}
            </DialogDescription>
          </DialogHeader>
          <Field label="What's wrong?">
            <textarea value={breakdownNotes} onChange={(e) => setBreakdownNotes(e.target.value)} placeholder="e.g. Not holding temperature, compressor tripping" className={textareaClass} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakdownOpen(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={() => saveBreakdown(breakdownNotes)} className="h-9 bg-red-600 px-4 hover:bg-red-700">
              Mark as breakdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Next service */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="size-4" /> Schedule next service
            </DialogTitle>
            <DialogDescription>A reminder appears when this date is reached. Logging a service with its own next date replaces it.</DialogDescription>
          </DialogHeader>
          <Field label="Next service date">
            <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="h-9" />
          </Field>
          <DialogFooter>
            {unit.nextServiceDate && (
              <Button variant="ghost" onClick={() => saveSchedule(null)} className="mr-auto h-9 px-3 text-muted-foreground">
                Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => setScheduleOpen(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={() => saveSchedule(scheduleDate)} disabled={!scheduleDate} className="h-9 px-4 hover:bg-(--brand-red-dark)">
              Save date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
