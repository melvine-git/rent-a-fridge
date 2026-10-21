'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/status-badge';
import { KpiCard } from '@/components/app/kpi-card';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { markDelivered, markCollected } from '@/lib/actions';
import { DeliveryChecklistComponent } from './delivery-checklist';
import { POWER_LABELS, UNIT_SIZE_LABELS } from '@/lib/domain';
import { daysFromToday, formatDate, formatDayDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Booking, Customer, Unit, Staff, DeliveryDocket, BookingWithDetails } from '@/types';
import {
  Check,
  CalendarClock,
  CircleCheck,
  Clock,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Thermometer,
  Truck,
  Zap,
  Box,
  TriangleAlert,
  ArrowUpRight,
} from 'lucide-react';

type JobWithDetails = BookingWithDetails;
type DocketWithDetails = DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff };
type JobType = 'delivery' | 'collection';

interface DeliveriesViewProps {
  tomorrowDeliveries: JobWithDetails[];
  todayDeliveries: JobWithDetails[];
  activeHires: JobWithDetails[];
  collectionsDue: JobWithDetails[];
  staff: Staff[];
  allDockets: DocketWithDetails[];
  upcomingDockets: DocketWithDetails[];
}

export function DeliveriesView({
  tomorrowDeliveries,
  todayDeliveries,
  activeHires,
  collectionsDue,
  staff,
  allDockets,
  upcomingDockets,
}: DeliveriesViewProps) {
  const router = useRouter();
  const [job, setJob] = useState<{ booking: JobWithDetails; type: JobType } | null>(null);
  const [selectedDocket, setSelectedDocket] = useState<DocketWithDetails | null>(null);
  const [[todayDate, tomorrowDate]] = useState(() => {
    const t = new Date();
    const n = new Date(t);
    n.setDate(n.getDate() + 1);
    return [t, n] as const;
  });

  const completedDockets = allDockets
    .filter((d) => d.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? b.scheduledDate).localeCompare(a.completedAt ?? a.scheduledDate));
  const dueIds = new Set(collectionsDue.map((c) => c.id));
  const byTime = (a: JobWithDetails, b: JobWithDetails, key: 'deliveryTime' | 'collectionTime') =>
    (a[key] ?? '99').localeCompare(b[key] ?? '99');

  const open = (booking: JobWithDetails, type: JobType) => setJob({ booking, type });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Deliveries today" value={todayDeliveries.length} icon={Truck} tone="scheduled" />
        <KpiCard label="Deliveries tomorrow" value={tomorrowDeliveries.length} icon={CalendarClock} tone="neutral" />
        <KpiCard
          label="Collections due"
          value={collectionsDue.length}
          icon={PackageCheck}
          tone={collectionsDue.length ? 'danger' : 'neutral'}
          emphasis={collectionsDue.length > 0}
        />
        <KpiCard label="Units on hire" value={activeHires.length} icon={Box} tone="info" />
      </div>

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BoardColumn
          title="Today"
          subtitle={formatDayDate(todayDate)}
          accent="bg-violet-500"
          jobs={[...todayDeliveries].sort((a, b) => byTime(a, b, 'deliveryTime'))}
          type="delivery"
          onOpen={open}
          emptyText="No deliveries today"
        />
        <BoardColumn
          title="Tomorrow"
          subtitle={formatDayDate(tomorrowDate)}
          accent="bg-stone-400"
          jobs={[...tomorrowDeliveries].sort((a, b) => byTime(a, b, 'deliveryTime'))}
          type="delivery"
          onOpen={open}
          emptyText="Nothing scheduled for tomorrow"
        />
        <BoardColumn
          title="Collections due"
          subtitle="Hire period ended"
          accent="bg-red-500"
          jobs={[...collectionsDue].sort((a, b) => a.endDate.localeCompare(b.endDate))}
          type="collection"
          onOpen={open}
          emptyText="No collections due"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Active hires */}
        <Panel title="On hire" count={activeHires.length} description="Units currently with customers" className="xl:col-span-3">
          {activeHires.length === 0 ? (
            <EmptyState compact icon={Box} title="No active hires" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Unit</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Return</th>
                    <th className="w-28 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...activeHires]
                    .sort((a, b) => a.endDate.localeCompare(b.endDate))
                    .map((h) => {
                      const d = daysFromToday(h.endDate);
                      return (
                        <tr key={h.id} className="hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2">
                              <UnitTypeIcon type={h.unit.unitType} />
                              <UnitCode id={h.unit.id} />
                            </span>
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-foreground">{h.customer.name}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {dueIds.has(h.id) ? (
                              <Pill tone="danger">{d < 0 ? `${-d}d overdue` : 'Due today'}</Pill>
                            ) : (
                              <span className="tabular text-muted-foreground">{formatDate(h.endDate)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button variant="outline" size="sm" onClick={() => open(h, 'collection')}>
                              Collect
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4 xl:col-span-2">
          {upcomingDockets.length > 0 && (
            <Panel title="Scheduled dockets" count={upcomingDockets.length}>
              <ul className="divide-y">
                {upcomingDockets.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button onClick={() => setSelectedDocket(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                      <Truck className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <UnitCode id={d.unit.id} />
                          <span className="truncate text-muted-foreground">{d.customer.name}</span>
                        </div>
                      </div>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {formatDate(d.scheduledDate)}
                        {d.scheduledTime && ` · ${d.scheduledTime}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Recently completed" count={completedDockets.length}>
            {completedDockets.length === 0 ? (
              <EmptyState compact icon={CircleCheck} title="No completed jobs yet" />
            ) : (
              <ul className="divide-y">
                {completedDockets.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md',
                        d.type === 'DELIVERY' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'
                      )}
                    >
                      {d.type === 'DELIVERY' ? <Truck className="size-3.5" /> : <PackageCheck className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <UnitCode id={d.unit.id} />
                        <span className="truncate text-muted-foreground">{d.customer.name}</span>
                      </div>
                      {d.signedBy && <div className="truncate text-xs text-muted-foreground">Signed by {d.signedBy}</div>}
                    </div>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {formatDate(d.completedAt ? d.completedAt.split('T')[0] : d.scheduledDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Job drawer */}
      <Sheet open={!!job} onOpenChange={(o) => !o && setJob(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
          {job && (
            <JobSheet
              key={job.booking.id + job.type}
              job={job.booking}
              type={job.type}
              staff={staff}
              onComplete={() => {
                setJob(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedDocket} onOpenChange={(o) => !o && setSelectedDocket(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delivery checklist</DialogTitle>
          </DialogHeader>
          {selectedDocket && (
            <DeliveryChecklistComponent
              docket={selectedDocket}
              onComplete={() => {
                setSelectedDocket(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoardColumn({
  title,
  subtitle,
  accent,
  jobs,
  type,
  onOpen,
  emptyText,
}: {
  title: string;
  subtitle: string;
  accent: string;
  jobs: JobWithDetails[];
  type: JobType;
  onOpen: (job: JobWithDetails, type: JobType) => void;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col rounded-[var(--radius-lg)] border bg-muted/40">
      <header className="flex items-center gap-2 px-4 py-3">
        <span className={cn('size-2 rounded-full', accent)} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="tabular rounded bg-white px-1.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">{jobs.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
      </header>
      <div className="flex-1 space-y-2 px-2 pb-2">
        {jobs.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-md border border-dashed bg-white/60 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          jobs.map((j, i) => <JobCard key={j.id} job={j} type={type} index={i + 1} onClick={() => onOpen(j, type)} />)
        )}
      </div>
    </section>
  );
}

function JobCard({ job, type, index, onClick }: { job: JobWithDetails; type: JobType; index: number; onClick: () => void }) {
  const time = type === 'delivery' ? job.deliveryTime : job.collectionTime;
  const overdue = type === 'collection' ? -daysFromToday(job.endDate) : 0;
  return (
    <button
      onClick={onClick}
      className="group block w-full rounded-md border bg-white p-3 text-left shadow-[var(--shadow-xs)] transition-shadow outline-none hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="tabular flex size-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">
            {index}
          </span>
          <UnitCode id={job.unit.id} />
          <span className="text-xs text-muted-foreground">{UNIT_SIZE_LABELS[job.unit.size]}</span>
        </div>
        <span className="tabular flex items-center gap-1 text-xs font-medium text-foreground">
          <Clock className="size-3 text-muted-foreground" />
          {time ?? 'Any time'}
        </span>
      </div>
      <div className="mt-2 truncate text-sm font-medium text-foreground">{job.customer.name}</div>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">{job.deliveryAddress}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {type === 'delivery' ? (
          <>
            <Tag icon={<Thermometer className="size-3" />}>{job.tempRequired}°C</Tag>
            <Tag icon={<Zap className="size-3" />}>{job.powerAvailable === 'INDUSTRIAL' ? '32A' : '13A'}</Tag>
            {job.cableLength && <Tag>{job.cableLength} cable</Tag>}
          </>
        ) : overdue > 0 ? (
          <Pill tone="danger">{overdue}d overdue</Pill>
        ) : (
          <Pill tone="warning">Due today</Pill>
        )}
      </div>
    </button>
  );
}

function Tag({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

type CheckKey =
  | 'unitClean'
  | 'doorsSealed'
  | 'tempVerified'
  | 'powerConnected'
  | 'powerSupplyChecked'
  | 'powerCableConnected'
  | 'hitchLockSecured'
  | 'wheelClampSecured'
  | 'doorLockSecured';

function checklistFor(job: JobWithDetails, type: JobType): { key: CheckKey; label: string }[] {
  const acc = job.accessories;
  if (type === 'delivery') {
    return [
      { key: 'unitClean', label: 'Unit cleaned and inspected' },
      { key: 'doorsSealed', label: 'Door seals checked' },
      { key: 'powerSupplyChecked', label: `Site power verified (${POWER_LABELS[job.powerAvailable]})` },
      { key: 'powerCableConnected', label: `Power cable connected${job.cableLength ? ` (${job.cableLength})` : ''}` },
      { key: 'powerConnected', label: 'Unit powered on and running' },
      { key: 'tempVerified', label: `Temperature set to ${job.tempRequired}°C` },
      ...(acc?.hitchLock ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock fitted' }] : []),
      ...(acc?.wheelClamp ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp fitted' }] : []),
      ...(acc?.doorLock ? [{ key: 'doorLockSecured' as const, label: 'Door lock fitted' }] : []),
    ];
  }
  return [
    { key: 'powerConnected', label: 'Power disconnected and cable recovered' },
    { key: 'unitClean', label: 'Unit emptied and cleaned out' },
    { key: 'doorsSealed', label: 'Unit inspected for damage' },
    { key: 'tempVerified', label: 'Condition photos taken' },
    ...(acc?.hitchLock ? [{ key: 'hitchLockSecured' as const, label: 'Hitch lock recovered' }] : []),
    ...(acc?.wheelClamp ? [{ key: 'wheelClampSecured' as const, label: 'Wheel clamp recovered' }] : []),
    ...(acc?.doorLock ? [{ key: 'doorLockSecured' as const, label: 'Door lock recovered' }] : []),
  ];
}

function JobSheet({ job, type, staff, onComplete }: { job: JobWithDetails; type: JobType; staff: Staff[]; onComplete: () => void }) {
  const [isPending, startTransition] = useTransition();
  const items = checklistFor(job, type);
  const [checked, setChecked] = useState<Record<CheckKey, boolean>>({
    unitClean: false,
    doorsSealed: false,
    tempVerified: false,
    powerConnected: false,
    powerSupplyChecked: false,
    powerCableConnected: false,
    hitchLockSecured: false,
    wheelClampSecured: false,
    doorLockSecured: false,
  });
  const [signature, setSignature] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');

  const done = items.filter((i) => checked[i.key]).length;
  const ready = done === items.length && signature.trim().length > 0 && (!hasDamage || damageNotes.trim().length > 0);
  const driver = staff.find((s) => s.role === 'DRIVER');
  const isDelivery = type === 'delivery';

  const handleConfirm = () => {
    startTransition(async () => {
      const payload = {
        bookingId: job.id,
        staffId: driver?.id || 'staff-01',
        checklist: { ...checked, tempSetting: job.tempRequired, cableLengthUsed: job.cableLength },
        tempSet: isDelivery ? job.tempRequired : 0,
        signedBy: signature,
        damageNotes: hasDamage ? damageNotes : undefined,
        photoUrls: [],
      };
      const result = isDelivery ? await markDelivered(payload) : await markCollected(payload);
      if (result.success) {
        toast.success(isDelivery ? 'Delivery confirmed' : 'Collection confirmed', {
          description: `${job.unit.id} is now ${isDelivery ? 'on hire' : 'available'}`,
        });
        onComplete();
      } else {
        toast.error(`Could not confirm ${type}`, { description: result.error });
      }
    });
  };

  return (
    <>
      <SheetHeader className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Pill tone={isDelivery ? 'scheduled' : 'warning'} showDot>
            {isDelivery ? 'Delivery' : 'Collection'}
          </Pill>
          <span className="font-mono-unit text-xs text-muted-foreground">{job.id}</span>
        </div>
        <SheetTitle className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
          <UnitTypeIcon type={job.unit.unitType} className="size-5" />
          <span className="font-mono-unit">{job.unit.id}</span>
          <span className="font-normal text-muted-foreground">→</span>
          <span className="truncate">{job.customer.name}</span>
        </SheetTitle>
        <SheetDescription>
          {isDelivery
            ? `${formatDayDate(job.startDate)}${job.deliveryTime ? ` at ${job.deliveryTime}` : ''}`
            : `On hire since ${formatDate(job.startDate)} · due back ${formatDate(job.endDate)}`}
        </SheetDescription>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Site */}
        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{job.deliveryAddress}</div>
                {job.accessInstructions && <p className="mt-1 text-xs text-muted-foreground">{job.accessInstructions}</p>}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t pt-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground">{job.contactName}</div>
                <div className="tabular text-xs text-muted-foreground">{formatPhone(job.contactPhone)}</div>
              </div>
              <a href={`tel:${job.contactPhone}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                <Phone className="size-3.5" /> Call
              </a>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(job.deliveryAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
              >
                <Navigation className="size-3.5" /> Navigate
              </a>
            </div>
          </div>

          {isDelivery && (
            <div className="grid grid-cols-3 divide-x rounded-md border text-center">
              <Spec label="Temperature" value={`${job.tempRequired}°C`} />
              <Spec label="Power" value={job.powerAvailable === 'INDUSTRIAL' ? '32A' : '13A'} />
              <Spec label="Cable" value={job.cableLength ?? '—'} />
            </div>
          )}
        </div>

        {/* Checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{isDelivery ? 'Handover checklist' : 'Collection checklist'}</h3>
            <span className="tabular text-xs text-muted-foreground">
              {done}/{items.length} complete
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <ul className="divide-y rounded-md border">
            {items.map((item) => {
              const on = checked[item.key];
              return (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      onChange={(e) => setChecked((p) => ({ ...p, [item.key]: e.target.checked }))}
                    />
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                        on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-input bg-white'
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn('text-sm', on ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>
                      {item.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Damage */}
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={hasDamage} onChange={(e) => setHasDamage(e.target.checked)} className="size-4 accent-[var(--brand-red)]" />
            <TriangleAlert className="size-4 text-amber-600" /> Report damage or issue
          </label>
          {hasDamage && (
            <textarea
              placeholder="Describe the damage, location on the unit and any customer comments"
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              className="min-h-20 w-full resize-none rounded-lg border border-input px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          )}
        </div>

        {/* Sign-off */}
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">
            Customer sign-off <span className="text-[var(--brand-red)]">*</span>
          </span>
          <Input placeholder="Full name of person signing" value={signature} onChange={(e) => setSignature(e.target.value)} className="h-9" />
        </label>
      </div>

      <div className="flex items-center gap-2 border-t bg-white px-5 py-4">
        <Link
          href={`/bookings/${job.id}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          Booking <ArrowUpRight className="size-4" />
        </Link>
        <Button
          onClick={handleConfirm}
          disabled={!ready || isPending}
          className={cn('h-10 flex-1 text-sm font-semibold', isDelivery ? 'hover:bg-[var(--brand-red-dark)]' : 'bg-emerald-600 hover:bg-emerald-700')}
        >
          <CircleCheck />
          {isPending ? 'Confirming…' : isDelivery ? 'Confirm delivery' : 'Confirm collection'}
        </Button>
      </div>
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="tabular text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
