'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill } from '@/components/ui/status-badge';
import { KpiCard } from '@/components/app/kpi-card';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { TabBar } from '@/components/app/tab-bar';
import { AlertBanner } from '@/components/app/alert-banner';
import { Field, selectClass, textareaClass } from '@/components/app/field';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { Wrench, CalendarClock, ClipboardList, Cpu, Activity, Plus, CircleCheck, Settings, Thermometer, Fan, Gauge, CircuitBoard, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { addMaintenanceRecord, setUnitStatus } from '@/lib/actions';
import { formatDate, toISODate } from '@/lib/format';
import { COMPONENT_LABELS, RECORD_TYPE_META, GBP as gbp } from '@/lib/domain';
import type { Unit, MaintenanceRecord, BOMComponent } from '@/types';

type RecordWithUnit = MaintenanceRecord & { unit: Unit };
type ComponentWithUnit = BOMComponent & { unit: Unit };
type MaintenanceDueItem = { unit: Unit; record: MaintenanceRecord; daysOverdue: number };
type ServiceableComponent = { type: BOMComponent['type']; count: number; units: string[] };

interface MaintenanceViewProps {
  maintenanceRecords: RecordWithUnit[];
  maintenanceDue: MaintenanceDueItem[];
  unitsInMaintenance: Unit[];
  serviceableComponents: ServiceableComponent[];
  allComponents: ComponentWithUnit[];
  allUnits: Unit[];
}

const COMPONENT_ICONS: Record<BOMComponent['type'], typeof Cpu> = {
  COMPRESSOR: Gauge,
  EVAPORATOR: Thermometer,
  CONTROLLER: CircuitBoard,
  FAN_MOTOR: Fan,
  OTHER: Settings,
};

const SERVICEABLE_COMPONENTS_LIST = [
  { type: 'COMPRESSOR' as const, name: 'Compressor', description: 'Main refrigeration compressor unit', serviceInterval: '12 months' },
  { type: 'EVAPORATOR' as const, name: 'Evaporator', description: 'Evaporator coils and housing', serviceInterval: '6 months' },
  { type: 'CONTROLLER' as const, name: 'Temperature controller', description: 'Digital temperature control unit', serviceInterval: '12 months' },
  { type: 'FAN_MOTOR' as const, name: 'Fan motor', description: 'Evaporator and condenser fan motors', serviceInterval: '6 months' },
  { type: 'OTHER' as const, name: 'Door seals', description: 'Rubber door gaskets and seals', serviceInterval: '12 months' },
  { type: 'OTHER' as const, name: 'Refrigerant', description: 'Refrigerant gas levels and pressure', serviceInterval: '12 months' },
  { type: 'OTHER' as const, name: 'Electrical', description: 'Wiring, connections and safety switches', serviceInterval: '12 months' },
  { type: 'OTHER' as const, name: 'Drainage', description: 'Condensate drain and tray', serviceInterval: '6 months' },
];

const EMPTY_FORM = {
  type: 'SCHEDULED' as MaintenanceRecord['type'],
  description: '',
  performedBy: '',
  cost: '',
  partsReplaced: '',
  nextServiceDate: '',
};

export function MaintenanceView({
  maintenanceRecords,
  maintenanceDue,
  unitsInMaintenance,
  serviceableComponents,
  allComponents,
  allUnits,
}: MaintenanceViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'components' | 'datalogger'>('overview');
  const [showAddService, setShowAddService] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [serviceForm, setServiceForm] = useState(EMPTY_FORM);

  const handleAddService = async () => {
    if (!selectedUnit || !serviceForm.description) {
      toast.error('Select a unit and describe the work carried out');
      return;
    }
    const result = await addMaintenanceRecord(selectedUnit, {
      date: toISODate(new Date()),
      type: serviceForm.type,
      description: serviceForm.description,
      performedBy: serviceForm.performedBy,
      cost: serviceForm.cost ? parseFloat(serviceForm.cost) : undefined,
      partsReplaced: serviceForm.partsReplaced ? serviceForm.partsReplaced.split(',').map((s) => s.trim()) : undefined,
      nextServiceDate: serviceForm.nextServiceDate || undefined,
    });
    if (result.success) {
      toast.success(`Service logged for ${selectedUnit}`);
      setShowAddService(false);
      setSelectedUnit('');
      setServiceForm(EMPTY_FORM);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to add service record');
    }
  };

  const markAvailable = async (unitId: string) => {
    await setUnitStatus(unitId, 'AVAILABLE');
    toast.success(`${unitId} returned to fleet`);
    router.refresh();
  };

  const openDataLogger = (unitId: string, loggerId?: string) =>
    toast.info(loggerId ? `Connecting to logger ${loggerId}` : `No data logger configured for ${unitId}`, {
      description: loggerId ? 'Data logger integration is pending configuration.' : undefined,
    });

  return (
    <div className="space-y-6">
      {maintenanceDue.length > 0 && (
        <AlertBanner tone="danger" icon={CalendarClock} title={`${maintenanceDue.length} service${maintenanceDue.length > 1 ? 's' : ''} overdue`} description="Book these units in before their next hire">
          {maintenanceDue.slice(0, 5).map((item, idx) => (
            <li key={`${item.unit.id}-${idx}`}>
              <Link href={`/units/${item.unit.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40">
                <UnitCode id={item.unit.id} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{item.record.description}</span>
                <Pill tone={item.daysOverdue > 30 ? 'danger' : 'warning'}>
                  {item.daysOverdue === 0 ? 'Due today' : `${item.daysOverdue}d overdue`}
                </Pill>
              </Link>
            </li>
          ))}
        </AlertBanner>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="In maintenance" value={unitsInMaintenance.length} icon={Wrench} tone="warning" hint={`of ${allUnits.length} units`} />
        <KpiCard label="Service overdue" value={maintenanceDue.length} icon={CalendarClock} tone={maintenanceDue.length ? 'danger' : 'neutral'} emphasis={maintenanceDue.length > 0} />
        <KpiCard label="Service records" value={maintenanceRecords.length} icon={ClipboardList} tone="info" />
        <KpiCard label="Tracked components" value={allComponents.length} icon={Cpu} tone="neutral" />
      </div>

      <TabBar
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'logs', label: 'Service log', count: maintenanceRecords.length },
          { value: 'components', label: 'Serviceable parts' },
          { value: 'datalogger', label: 'Data loggers' },
        ]}
        trailing={
          <Button onClick={() => setShowAddService(true)} className="h-8 gap-1.5 px-3 hover:bg-[var(--brand-red-dark)]">
            <Plus /> Log service
          </Button>
        }
      />

      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Units in maintenance" count={unitsInMaintenance.length}>
            {unitsInMaintenance.length === 0 ? (
              <EmptyState compact icon={CircleCheck} title="All units operational" />
            ) : (
              <ul className="divide-y">
                {unitsInMaintenance.map((unit) => (
                  <li key={unit.id} className="flex items-center gap-3 px-4 py-3">
                    <UnitTypeIcon type={unit.unitType} boxed />
                    <Link href={`/units/${unit.id}`} className="min-w-0 flex-1">
                      <UnitCode id={unit.id} />
                      <p className="truncate text-xs text-muted-foreground">{unit.notes || 'No notes'}</p>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => markAvailable(unit.id)} className="h-8 px-2.5 text-xs">
                      Mark available
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent activity"
            action={
              <button onClick={() => setActiveTab('logs')} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                View all
              </button>
            }
          >
            {maintenanceRecords.length === 0 ? (
              <EmptyState compact icon={ClipboardList} title="No service records" />
            ) : (
              <ul className="divide-y">
                {maintenanceRecords.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <UnitCode id={r.unit.id} />
                        <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{r.description}</p>
                    </div>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">{formatDate(r.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'logs' && (
        <Panel title="Service log" count={maintenanceRecords.length}>
          {maintenanceRecords.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No service records yet"
              action={
                <Button variant="outline" onClick={() => setShowAddService(true)}>
                  Log first service
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Unit</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Work carried out</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Technician</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Next service</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {maintenanceRecords.map((r) => (
                    <tr key={r.id} className="cursor-pointer align-top hover:bg-muted/40" onClick={() => router.push(`/units/${r.unit.id}`)}>
                      <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(r.date, { year: true })}</td>
                      <td className="px-4 py-3">
                        <UnitCode id={r.unit.id} />
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <div className="text-foreground">{r.description}</div>
                        {r.partsReplaced && r.partsReplaced.length > 0 && (
                          <div className="mt-0.5 text-xs text-muted-foreground">Parts: {r.partsReplaced.join(', ')}</div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{r.performedBy || '—'}</td>
                      <td className="tabular px-4 py-3 text-right whitespace-nowrap text-foreground">{r.cost ? gbp.format(r.cost) : '—'}</td>
                      <td className="tabular hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">{formatDate(r.nextServiceDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'components' && (
        <div className="space-y-4">
          <Panel title="Installed components by type">
            <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0">
              {serviceableComponents.map((c) => {
                const Icon = COMPONENT_ICONS[c.type];
                return (
                  <div key={c.type} className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="size-4" /> {COMPONENT_LABELS[c.type]}
                    </div>
                    <div className="tabular mt-2 text-2xl font-semibold text-foreground">{c.count}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.units.length} units</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Service schedule" description="Recommended service intervals. Final list to be confirmed by the service team.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Component</th>
                    <th className="px-4 py-2.5 font-medium">Scope</th>
                    <th className="px-4 py-2.5 text-right font-medium">Interval</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {SERVICEABLE_COMPONENTS_LIST.map((c) => {
                    const Icon = COMPONENT_ICONS[c.type];
                    return (
                      <tr key={c.name}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <Icon className="size-4 text-muted-foreground" /> {c.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.description}</td>
                        <td className="px-4 py-3 text-right">
                          <Pill tone="neutral">Every {c.serviceInterval}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'datalogger' && (
        <Panel title="Data loggers" description="Temperature logger integration is pending configuration with the external provider">
          <ul className="divide-y">
            {allUnits.map((unit) => (
              <li key={unit.id} className="flex items-center gap-3 px-4 py-3">
                <Activity className={unit.dataLoggerId ? 'size-4 text-emerald-600' : 'size-4 text-muted-foreground/50'} />
                <UnitCode id={unit.id} className="w-20" />
                <span className="flex-1 text-sm text-muted-foreground">
                  {unit.dataLoggerId ? <span className="font-mono text-xs text-foreground">{unit.dataLoggerId}</span> : 'Not configured'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!unit.dataLoggerId}
                  onClick={() => openDataLogger(unit.id, unit.dataLoggerId)}
                  className="h-8 gap-1.5 px-2.5 text-xs"
                >
                  <ExternalLink className="size-3.5" /> View logs
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Log service</DialogTitle>
            <DialogDescription>Record maintenance work against a unit. Setting a next service date creates a reminder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Unit" required>
                <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className={selectClass}>
                  <option value="">Select unit…</option>
                  {allUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  value={serviceForm.type}
                  onChange={(e) => setServiceForm((p) => ({ ...p, type: e.target.value as MaintenanceRecord['type'] }))}
                  className={selectClass}
                >
                  <option value="SCHEDULED">Scheduled service</option>
                  <option value="REPAIR">Repair</option>
                  <option value="INSPECTION">Inspection</option>
                </select>
              </Field>
            </div>
            <Field label="Work carried out" required>
              <textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Replaced evaporator fan, cleaned condenser coils"
                className={textareaClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Technician">
                <Input value={serviceForm.performedBy} onChange={(e) => setServiceForm((p) => ({ ...p, performedBy: e.target.value }))} className="h-9" />
              </Field>
              <Field label="Cost (£)">
                <Input type="number" min="0" step="0.01" value={serviceForm.cost} onChange={(e) => setServiceForm((p) => ({ ...p, cost: e.target.value }))} className="h-9" />
              </Field>
            </div>
            <Field label="Parts replaced" hint="Separate multiple parts with commas">
              <Input value={serviceForm.partsReplaced} onChange={(e) => setServiceForm((p) => ({ ...p, partsReplaced: e.target.value }))} className="h-9" />
            </Field>
            <Field label="Next service date">
              <Input type="date" value={serviceForm.nextServiceDate} onChange={(e) => setServiceForm((p) => ({ ...p, nextServiceDate: e.target.value }))} className="h-9" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddService(false)} className="h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleAddService} className="h-9 px-4 hover:bg-[var(--brand-red-dark)]">
              Save record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
