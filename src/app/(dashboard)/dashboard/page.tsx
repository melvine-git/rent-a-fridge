import Link from 'next/link';
import { getDashboardData, getShellData } from '@/lib/actions';
import { PageHeader } from '@/components/app/page-header';
import { KpiCard } from '@/components/app/kpi-card';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/empty-state';
import { Avatar } from '@/components/app/avatar';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { Pill } from '@/components/ui/status-badge';
import { UNIT_TYPE_LABELS, TONE_CLASSES } from '@/lib/domain';
import { formatDate, formatDayDate, formatRelativeDay, greeting } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Box,
  CalendarCheck,
  CircleAlert,
  Gauge,
  MapPin,
  PackageCheck,
  Truck,
  Wrench,
} from 'lucide-react';
import type { BookingWithDetails, UnitType } from '@/types';

export const dynamic = 'force-dynamic';

type Job = { kind: 'delivery' | 'collection'; date: string; time?: string; booking: BookingWithDetails };

export default async function DashboardPage() {
  const [data, shell] = await Promise.all([getDashboardData(), getShellData()]);
  const { units, deliveries, collections, upcoming, today, tomorrow } = data;

  const onHire = units.filter((u) => u.status === 'ON_HIRE').length;
  const available = units.filter((u) => u.status === 'AVAILABLE').length;
  const maintenance = units.filter((u) => u.status === 'MAINTENANCE').length;
  const rentable = units.length - maintenance;
  const utilisation = rentable ? Math.round((onHire / rentable) * 100) : 0;

  const jobs: Job[] = [
    ...deliveries.map((b) => ({ kind: 'delivery' as const, date: b.startDate, time: b.deliveryTime, booking: b })),
    ...collections.map((b) => ({
      kind: 'collection' as const,
      date: b.endDate < today ? today : b.endDate,
      time: b.collectionTime,
      booking: b,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));

  const todayJobs = jobs.filter((j) => j.date === today);
  const tomorrowJobs = jobs.filter((j) => j.date === tomorrow);
  const overdueCollections = collections.filter((b) => b.endDate < today).length;

  const byType = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => {
    const list = units.filter((u) => u.unitType === type);
    return {
      type,
      total: list.length,
      available: list.filter((u) => u.status === 'AVAILABLE').length,
      onHire: list.filter((u) => u.status === 'ON_HIRE').length,
      maintenance: list.filter((u) => u.status === 'MAINTENANCE').length,
    };
  });

  const alerts = shell.notifications.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting()}
        description={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Here’s what’s happening across the fleet today.`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Fleet utilisation"
          value={`${utilisation}%`}
          icon={Gauge}
          tone="info"
          progress={utilisation}
          hint={`${onHire} of ${rentable} rentable units on hire`}
          href="/units"
        />
        <KpiCard
          label="Available now"
          value={available}
          icon={Box}
          tone="success"
          hint={maintenance ? `${maintenance} in maintenance` : 'No units in maintenance'}
          href="/units"
        />
        <KpiCard
          label="Deliveries today"
          value={deliveries.filter((b) => b.startDate === today).length}
          icon={Truck}
          tone="scheduled"
          hint={`${deliveries.filter((b) => b.startDate === tomorrow).length} scheduled tomorrow`}
          href="/deliveries"
        />
        <KpiCard
          label="Collections due"
          value={collections.filter((b) => b.endDate <= today).length}
          icon={PackageCheck}
          tone={overdueCollections ? 'danger' : 'warning'}
          emphasis={overdueCollections > 0}
          hint={overdueCollections ? `${overdueCollections} overdue` : 'None overdue'}
          href="/collections"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Schedule */}
        <Panel
          className="lg:col-span-2"
          title="Dispatch schedule"
          description="Deliveries and collections for today and tomorrow"
          action={
            <Link href="/deliveries" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              Open dispatch <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {jobs.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Nothing scheduled" description="No deliveries or collections for today or tomorrow." />
          ) : (
            <div>
              <JobGroup label="Today" date={today} jobs={todayJobs} today={today} />
              <JobGroup label="Tomorrow" date={tomorrow} jobs={tomorrowJobs} today={today} />
            </div>
          )}
        </Panel>

        <div className="space-y-4 lg:space-y-6">
          {/* Fleet status */}
          <Panel
            title="Fleet status"
            count={units.length}
            action={
              <Link href="/units" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          >
            <div className="space-y-4 p-4">
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {[
                    { n: onHire, c: TONE_CLASSES.info.dot },
                    { n: available, c: TONE_CLASSES.success.dot },
                    { n: maintenance, c: TONE_CLASSES.warning.dot },
                  ].map((s, i) => (
                    <div key={i} className={s.c} style={{ width: `${units.length ? (s.n / units.length) * 100 : 0}%` }} />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Legend dot={TONE_CLASSES.info.dot} label="On hire" value={onHire} />
                  <Legend dot={TONE_CLASSES.success.dot} label="Available" value={available} />
                  <Legend dot={TONE_CLASSES.warning.dot} label="Service" value={maintenance} />
                </div>
              </div>
              <ul className="divide-y rounded-md border">
                {byType.map((t) => (
                  <li key={t.type} className="flex items-center gap-3 px-3 py-2.5">
                    <UnitTypeIcon type={t.type} />
                    <span className="flex-1 text-sm text-foreground">{UNIT_TYPE_LABELS[t.type]}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      <span className="font-semibold text-emerald-700">{t.available}</span> free / {t.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          {/* Attention */}
          <Panel title="Needs attention" count={shell.notifications.length}>
            {alerts.length === 0 ? (
              <EmptyState compact icon={CalendarCheck} title="All clear" description="No overdue actions or service reminders." />
            ) : (
              <ul className="divide-y">
                {alerts.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50">
                      {n.kind === 'SERVICE_DUE' ? (
                        <Wrench className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      ) : (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDay(n.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Upcoming */}
      <Panel
        title="Upcoming hires"
        description="Confirmed bookings starting in the next 7 days"
        count={upcoming.length}
        action={
          <Link href="/bookings" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            Timeline <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState compact icon={CalendarCheck} title="No upcoming hires this week" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Hire period</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Delivery address</th>
                  <th className="px-4 py-2.5 text-right font-medium">Starts</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {upcoming.map((b) => (
                  <tr key={b.id} className="group hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/bookings/${b.id}`} className="flex items-center gap-3">
                        <Avatar name={b.customer.name} size="sm" />
                        <span className="font-medium text-foreground group-hover:underline">{b.customer.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <UnitTypeIcon type={b.unit.unitType} />
                        <UnitCode id={b.unit.id} />
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-muted-foreground">
                      {formatDate(b.startDate)} – {formatDate(b.endDate)}
                    </td>
                    <td className="hidden max-w-[280px] truncate px-4 py-3 text-muted-foreground md:table-cell">{b.deliveryAddress}</td>
                    <td className="px-4 py-3 text-right">
                      <Pill tone="scheduled">{formatRelativeDay(b.startDate)}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className={cn('size-2 rounded-full', dot)} />
        {label}
      </div>
      <div className="tabular mt-0.5 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function JobGroup({ label, date, jobs, today }: { label: string; date: string; jobs: Job[]; today: string }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{formatDayDate(date)}</span>
      </div>
      {jobs.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">No jobs scheduled.</p>
      ) : (
        <ul className="divide-y">
          {jobs.map((j) => {
            const b = j.booking;
            const overdue = j.kind === 'collection' && b.endDate < today;
            return (
              <li key={`${j.kind}-${b.id}`}>
                <Link href={`/bookings/${b.id}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-muted/40">
                  <span className="tabular text-sm font-semibold text-foreground">{j.time ?? '—'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{b.customer.name}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <UnitCode id={b.unit.id} className="text-xs text-muted-foreground" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{b.deliveryAddress}</span>
                    </div>
                  </div>
                  {j.kind === 'delivery' ? (
                    <Pill tone="scheduled" showDot>Delivery</Pill>
                  ) : (
                    <Pill tone={overdue ? 'danger' : 'warning'} showDot>
                      {overdue ? `Overdue · ${formatDate(b.endDate)}` : 'Collection'}
                    </Pill>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
