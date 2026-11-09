'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pill, StatusBadge } from '@/components/ui/status-badge';
import { KpiDrilldown } from '@/components/app/kpi-drilldown';
import { COMPONENT_ICONS } from '@/components/app/component-icon';
import { ServiceRecordDialog, AttachmentLinks } from '@/components/maintenance/service-record-dialog';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { TabBar } from '@/components/app/tab-bar';
import { AlertBanner } from '@/components/app/alert-banner';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { Wrench, CalendarClock, ClipboardList, Cpu, Activity, Plus, CircleCheck, ExternalLink, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { setUnitBreakdown, setUnitStatus } from '@/lib/actions';
import { formatDate } from '@/lib/format';
import { COMPONENT_LABELS, RECORD_TYPE_META, unitDisplayStatus } from '@/lib/domain';
import { ServiceableComponents } from './serviceable-components';
import type { Unit, MaintenanceRecord, BOMComponent, ServiceableComponent } from '@/types';

type RecordWithUnit = MaintenanceRecord & { unit: Unit };
type ComponentWithUnit = BOMComponent & { unit: Unit };
type MaintenanceDueItem = { unit: Unit; dueDate: string; lastRecord?: MaintenanceRecord; daysOverdue: number };
type InstalledByType = { type: BOMComponent['type']; count: number; units: string[] };

interface MaintenanceViewProps {
  maintenanceRecords: RecordWithUnit[];
  maintenanceDue: MaintenanceDueItem[];
  unitsInMaintenance: Unit[];
  serviceableComponents: InstalledByType[];
  serviceList: ServiceableComponent[];
  allComponents: ComponentWithUnit[];
  allUnits: Unit[];
}

const dueLabel = (d: number) => (d === 0 ? 'Due today' : `${d}d overdue`);

export function MaintenanceView({
  maintenanceRecords,
  maintenanceDue,
  unitsInMaintenance,
  serviceableComponents,
  serviceList,
  allComponents,
  allUnits,
}: MaintenanceViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'components' | 'datalogger'>('overview');
  const [dialog, setDialog] = useState<{ key: number; record?: RecordWithUnit } | null>(null);
  const openDialog = (record?: RecordWithUnit) => setDialog({ key: Date.now(), record });

  const returnToFleet = async (unit: Unit) => {
    if (unit.breakdown) await setUnitBreakdown(unit.id, null);
    if (unit.status === 'MAINTENANCE') await setUnitStatus(unit.id, 'AVAILABLE');
    toast.success(`${unit.id} returned to fleet`);
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
          {maintenanceDue.slice(0, 5).map((item) => (
            <li key={item.unit.id}>
              <Link href={`/units/${item.unit.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40">
                <UnitCode id={item.unit.id} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Due {formatDate(item.dueDate)}
                  {item.lastRecord && ` · last: ${item.lastRecord.description}`}
                </span>
                <Pill tone={item.daysOverdue > 30 ? 'danger' : 'warning'}>{dueLabel(item.daysOverdue)}</Pill>
              </Link>
            </li>
          ))}
        </AlertBanner>
      )}

      <KpiDrilldown
        cards={[
          {
            key: 'out',
            label: 'In maintenance',
            icon: Wrench,
            tone: 'warning',
            hint: `of ${allUnits.length} units, incl. breakdowns`,
            items: unitsInMaintenance.map((u) => ({
              key: u.id,
              href: `/units/${u.id}`,
              title: <UnitCode id={u.id} />,
              subtitle: u.breakdown?.notes || u.notes || undefined,
              meta: <StatusBadge status={unitDisplayStatus(u)} />,
            })),
            emptyText: 'All units operational',
          },
          {
            key: 'due',
            label: 'Service overdue',
            icon: CalendarClock,
            tone: maintenanceDue.length ? 'danger' : 'neutral',
            emphasis: maintenanceDue.length > 0,
            items: maintenanceDue.map((d) => ({ key: d.unit.id, href: `/units/${d.unit.id}`, title: <UnitCode id={d.unit.id} />, subtitle: `Due ${formatDate(d.dueDate)}`, meta: dueLabel(d.daysOverdue) })),
            emptyText: 'No services overdue',
          },
          {
            key: 'records',
            label: 'Service records',
            icon: ClipboardList,
            tone: 'info',
            items: maintenanceRecords.map((r) => ({
              key: r.id,
              href: `/units/${r.unit.id}`,
              title: (
                <span className="flex items-center gap-2">
                  <UnitCode id={r.unit.id} /> {r.description}
                </span>
              ),
              subtitle: [RECORD_TYPE_META[r.type].label, r.performedBy, r.orderNumbers?.length ? `Order ${r.orderNumbers.join(', ')}` : ''].filter(Boolean).join(' · '),
              meta: formatDate(r.date),
            })),
          },
          {
            key: 'components',
            label: 'Tracked components',
            icon: Cpu,
            tone: 'neutral',
            items: allComponents.map((c) => ({
              key: `${c.unit.id}-${c.id}`,
              href: `/units/${c.unit.id}`,
              title: (
                <span className="flex items-center gap-2">
                  <UnitCode id={c.unit.id} /> {c.name}
                </span>
              ),
              subtitle: [COMPONENT_LABELS[c.type], c.manufacturer, c.model, c.serialNumber].filter(Boolean).join(' · '),
            })),
            emptyText: 'No components recorded yet. Add them from a unit page.',
          },
        ]}
      />

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
          <Button onClick={() => openDialog()} className="h-8 gap-1.5 px-3 hover:bg-[var(--brand-red-dark)]">
            <Plus /> Log service
          </Button>
        }
      />

      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Out of action" description="In maintenance or broken down" count={unitsInMaintenance.length}>
            {unitsInMaintenance.length === 0 ? (
              <EmptyState compact icon={CircleCheck} title="All units operational" />
            ) : (
              <ul className="divide-y">
                {unitsInMaintenance.map((unit) => (
                  <li key={unit.id} className="flex items-center gap-3 px-4 py-3">
                    <UnitTypeIcon type={unit.unitType} boxed />
                    <Link href={`/units/${unit.id}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <UnitCode id={unit.id} />
                        <StatusBadge status={unitDisplayStatus(unit)} />
                        {unit.breakdown && unit.status === 'ON_HIRE' && <span className="text-xs text-muted-foreground">on hire</span>}
                      </span>
                      <p className="truncate text-xs text-muted-foreground">{unit.breakdown?.notes || unit.notes || 'No notes'}</p>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => returnToFleet(unit)} className="h-8 px-2.5 text-xs">
                      {unit.breakdown ? 'Fixed' : 'Mark available'}
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
                  <li key={r.id}>
                    <button onClick={() => openDialog(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <UnitCode id={r.unit.id} />
                          <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                          {!!r.attachments?.length && <Paperclip className="size-3.5 text-muted-foreground" aria-label="Has documents" />}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{r.description}</p>
                      </div>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">{formatDate(r.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'logs' && (
        <Panel title="Service log" count={maintenanceRecords.length} description="Click a record to edit it or attach documents">
          {maintenanceRecords.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No service records yet"
              action={
                <Button variant="outline" onClick={() => openDialog()}>
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
                    <th className="px-4 py-2.5 text-right font-medium">Hours</th>
                    <th className="px-4 py-2.5 font-medium">Order nos.</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Next service</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {maintenanceRecords.map((r) => (
                    <tr key={r.id} className="cursor-pointer align-top hover:bg-muted/40" onClick={() => openDialog(r)}>
                      <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(r.date, { year: true })}</td>
                      <td className="px-4 py-3">
                        <Link href={`/units/${r.unit.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          <UnitCode id={r.unit.id} />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={RECORD_TYPE_META[r.type].tone}>{RECORD_TYPE_META[r.type].label}</Pill>
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <div className="text-foreground">{r.description}</div>
                        {r.partsReplaced && r.partsReplaced.length > 0 && <div className="mt-0.5 text-xs text-muted-foreground">Parts: {r.partsReplaced.join(', ')}</div>}
                        {!!r.attachments?.length && (
                          <div className="mt-1.5">
                            <AttachmentLinks files={r.attachments} />
                          </div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{r.performedBy || '—'}</td>
                      <td className="tabular px-4 py-3 text-right whitespace-nowrap text-foreground">{r.hoursWorked !== undefined ? `${r.hoursWorked}h` : '—'}</td>
                      <td className="px-4 py-3">
                        {r.orderNumbers?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.orderNumbers.map((o) => (
                              <span key={o} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {o}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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
            <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
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

          <ServiceableComponents components={serviceList} />
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
                <Button size="sm" variant="outline" disabled={!unit.dataLoggerId} onClick={() => openDataLogger(unit.id, unit.dataLoggerId)} className="h-8 gap-1.5 px-2.5 text-xs">
                  <ExternalLink className="size-3.5" /> View logs
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {dialog && (
        <ServiceRecordDialog
          key={dialog.key}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          units={allUnits}
          unitId={dialog.record?.unit.id}
          record={dialog.record}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
