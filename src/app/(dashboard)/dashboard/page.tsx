import Link from 'next/link';
import { getDashboardData, getShellData } from '@/lib/actions';
import { Avatar } from '@/components/app/avatar';
import { UnitTypeIcon, UnitCode } from '@/components/app/unit-type-icon';
import { UNIT_TYPE_LABELS, TONE_CLASSES, unitDisplayStatus, type Tone, type UnitDisplayStatus } from '@/lib/domain';
import { groupVisits } from '@/lib/jobs';
import { formatDate, formatDayDate, formatRelativeDay, greeting } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  CircleAlert,
  Gauge,
  MapPin,
  PackageCheck,
  PenLine,
  TriangleAlert,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AppNotification, BookingWithDetails, UnitType } from '@/types';

export const dynamic = 'force-dynamic';

type Visit = { kind: 'delivery' | 'collection'; date: string; time?: string; lines: BookingWithDetails[] };
type AttentionItem = { id: string; icon: LucideIcon; tone: Tone; title: string; description: string; meta: string; href: string };

const NOTIFICATION_META: Record<AppNotification['kind'], { icon: LucideIcon; tone: Tone }> = {
  BREAKDOWN: { icon: TriangleAlert, tone: 'danger' },
  COLLECTION_OVERDUE: { icon: PackageCheck, tone: 'warning' },
  SERVICE_DUE: { icon: Wrench, tone: 'warning' },
  ACTION_OVERDUE: { icon: CircleAlert, tone: 'danger' },
};
const ATTENTION_ORDER: Record<string, number> = { LATE: 0, BREAKDOWN: 1, COLLECTION_OVERDUE: 2, ACTION_OVERDUE: 3, SERVICE_DUE: 4 };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const [data, shell] = await Promise.all([getDashboardData(), getShellData()]);
  const { units, deliveries, collections, upcoming, upcomingTotal, activity, today, tomorrow } = data;

  // Breakdown overrides the stored status, so a broken unit never counts as available
  const count = (list: typeof units, s: UnitDisplayStatus) => list.filter((u) => unitDisplayStatus(u) === s).length;
  const onHire = count(units, 'ON_HIRE');
  const available = count(units, 'AVAILABLE');
  const maintenance = count(units, 'MAINTENANCE');
  const breakdown = count(units, 'BREAKDOWN');
  const rentable = units.length - maintenance - breakdown;
  const utilisation = rentable ? Math.round((onHire / rentable) * 100) : 0;

  const late = upcoming.filter((u) => u.startDate < today);
  const overdueCollections = collections.filter((b) => b.endDate < today);
  const deliveriesToday = deliveries.filter((b) => b.startDate === today);
  const deliveriesTomorrow = deliveries.filter((b) => b.startDate === tomorrow);
  const collectionsDue = collections.filter((b) => b.endDate <= today);

  const visits: Visit[] = [
    ...groupVisits(deliveries, (b) => b.startDate).map((lines) => ({ kind: 'delivery' as const, date: lines[0].startDate, time: lines[0].deliveryTime, lines })),
    ...groupVisits(collections, (b) => b.endDate).map((lines) => ({
      kind: 'collection' as const,
      // Overdue collections belong on today's run
      date: lines[0].endDate < today ? today : lines[0].endDate,
      time: lines[0].collectionTime,
      lines,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));

  const attention: AttentionItem[] = [
    ...late.map((u) => ({
      id: `late-${u.reference}`,
      icon: Truck,
      tone: 'danger' as const,
      title: `Delivery late · ${u.lines.map((l) => l.unit.id).join(', ')}`,
      description: `${u.lines[0].customer.name} · was due ${formatDate(u.startDate)}`,
      meta: formatRelativeDay(u.startDate),
      href: `/bookings/${u.reference}`,
      order: ATTENTION_ORDER.LATE,
    })),
    ...shell.notifications.map((n) => ({
      id: n.id,
      ...NOTIFICATION_META[n.kind],
      title: n.title,
      description: n.description,
      meta: formatRelativeDay(n.date),
      href: n.href,
      order: ATTENTION_ORDER[n.kind],
    })),
  ].sort((a, b) => a.order - b.order);

  const problems = [
    late.length && `${plural(late.length, 'delivery is', 'deliveries are')} late`,
    overdueCollections.length && `${plural(overdueCollections.length, 'collection is', 'collections are')} overdue`,
    breakdown && `${plural(breakdown, 'unit is', 'units are')} broken down`,
  ].filter(Boolean) as string[];
  const todayVisits = visits.filter((v) => v.date === today).length;
  const summary = problems.length
    ? `${problems.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    : todayVisits
      ? `Everything is on track. ${plural(todayVisits, 'job', 'jobs')} on today's run.`
      : 'Everything is on track. Nothing on the run today.';

  const byType = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => {
    const list = units.filter((u) => u.unitType === type);
    return { type, total: list.length, available: count(list, 'AVAILABLE') };
  });

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight text-foreground">{greeting()}</h1>
          <p className={cn('mt-1 text-[15px]', problems.length ? 'text-foreground/80' : 'text-muted-foreground')}>{summary}</p>
        </div>
        <Link
          href="/deliveries"
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border bg-white px-3.5 text-sm font-medium shadow-[var(--shadow-xs)] transition-colors hover:bg-muted sm:self-auto"
        >
          <Truck className="size-4" /> Open dispatch
        </Link>
      </header>

      {/* Needs attention */}
      {attention.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-red-200/70 bg-white shadow-[var(--shadow-xs)]">
          <header className="flex items-center gap-3 border-b border-red-100 bg-red-50/60 px-5 py-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-[var(--brand-red)] text-white">
              <CircleAlert className="size-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
            <span className="tabular rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{attention.length}</span>
          </header>
          {/* Dividers come from the gap showing the tinted background; an odd last item spans both columns so no empty tinted cell is left */}
          <ul className="grid gap-px bg-red-100/70 sm:grid-cols-2">
            {attention.slice(0, 6).map((a) => (
              <li key={a.id} className="min-w-0 bg-white sm:last:odd:col-span-2">
                <Link href={a.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-red-50/60">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[a.tone].soft)}>
                    <a.icon className={cn('size-4', TONE_CLASSES[a.tone].text)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{a.meta}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ul>
          {attention.length > 6 && <p className="border-t border-red-100 bg-white px-5 py-2 text-xs text-muted-foreground">+ {attention.length - 6} more in notifications (bell, top right)</p>}
        </section>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Fleet utilisation" value={`${utilisation}%`} icon={Gauge} tone="info" href="/units" progress={utilisation} hint={`${onHire} of ${rentable} rentable units on hire`} />
        <Stat
          label="Available now"
          value={available}
          icon={Box}
          tone="success"
          href="/units"
          hint={
            maintenance + breakdown ? (
              <>
                {maintenance > 0 && `${maintenance} in maintenance`}
                {maintenance > 0 && breakdown > 0 && ' · '}
                {breakdown > 0 && <span className="font-medium text-red-600">{breakdown} broken down</span>}
              </>
            ) : (
              'Whole fleet in service'
            )
          }
        />
        <Stat
          label="Deliveries today"
          value={deliveriesToday.length}
          icon={Truck}
          tone="scheduled"
          href="/deliveries"
          hint={
            <>
              {late.length > 0 && <span className="font-medium text-red-600">{late.length} late · </span>}
              {deliveriesTomorrow.length} tomorrow
            </>
          }
        />
        <Stat
          label="Collections due"
          value={collectionsDue.length}
          icon={PackageCheck}
          tone="warning"
          href="/collections"
          hint={overdueCollections.length ? <span className="font-medium text-red-600">{overdueCollections.length} overdue</span> : 'None overdue'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          {/* Schedule */}
          <Card title="Schedule" description="Deliveries and collections on the run" action={<CardLink href="/deliveries">Open dispatch</CardLink>}>
            <DaySchedule label="Today" date={today} visits={visits.filter((v) => v.date === today)} today={today} />
            <DaySchedule label="Tomorrow" date={tomorrow} visits={visits.filter((v) => v.date === tomorrow)} today={today} />
          </Card>

          {/* Upcoming */}
          <Card
            title="Upcoming hires"
            count={upcomingTotal}
            description={upcomingTotal > upcoming.length ? `Waiting for delivery, soonest first · showing ${upcoming.length} of ${upcomingTotal}` : 'Waiting for delivery, soonest first'}
            action={<CardLink href="/bookings">Timeline</CardLink>}
          >
            {upcoming.length === 0 ? (
              <Quiet icon={CalendarCheck}>No hires waiting for delivery.</Quiet>
            ) : (
              <ul className="divide-y">
                {upcoming.map(({ reference, lines, startDate }) => {
                  const b = lines[0];
                  const isLate = startDate < today;
                  const end = lines.map((l) => l.endDate).sort().at(-1)!;
                  return (
                    <li key={reference}>
                      <Link href={`/bookings/${reference}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-muted/40 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
                        <Avatar name={b.customer.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground group-hover:underline">{b.customer.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                            {lines.map((l) => (
                              <span key={l.id} className="inline-flex items-center gap-1">
                                <UnitTypeIcon type={l.unit.unitType} className="size-3.5" />
                                <UnitCode id={l.unit.id} className="text-xs text-muted-foreground" />
                              </span>
                            ))}
                            <span className="tabular">
                              {formatDate(startDate)} – {formatDate(end)}
                            </span>
                          </p>
                        </div>
                        <p className="hidden truncate text-sm text-muted-foreground md:block">{b.deliveryAddress}</p>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                            isLate ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-violet-50 text-violet-700 ring-violet-600/20'
                          )}
                        >
                          {isLate ? `Late · ${formatDate(startDate)}` : formatRelativeDay(startDate)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Fleet status */}
          <Card title="Fleet" count={units.length} action={<CardLink href="/units">View all</CardLink>}>
            <div className="space-y-5 p-5">
              <div>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                  {[
                    { n: onHire, c: TONE_CLASSES.info.dot },
                    { n: available, c: TONE_CLASSES.success.dot },
                    { n: maintenance, c: TONE_CLASSES.warning.dot },
                    { n: breakdown, c: TONE_CLASSES.danger.dot },
                  ]
                    .filter((s) => s.n > 0)
                    .map((s, i) => (
                      <div key={i} className={cn('rounded-full', s.c)} style={{ flexGrow: s.n }} />
                    ))}
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-2">
                  <Legend dot={TONE_CLASSES.info.dot} label="On hire" value={onHire} />
                  <Legend dot={TONE_CLASSES.success.dot} label="Available" value={available} />
                  <Legend dot={TONE_CLASSES.warning.dot} label="Service" value={maintenance} />
                  <Legend dot={TONE_CLASSES.danger.dot} label="Breakdown" value={breakdown} />
                </dl>
              </div>
              <ul className="space-y-3 border-t pt-4">
                {byType.map((t) => (
                  <li key={t.type}>
                    <div className="flex items-center gap-2.5 text-sm">
                      <UnitTypeIcon type={t.type} />
                      <span className="flex-1 text-foreground">{UNIT_TYPE_LABELS[t.type]}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{t.available}</span> of {t.total} free
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${t.total ? (t.available / t.total) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Activity */}
          <Card title="Recent activity">
            {activity.length === 0 ? (
              <Quiet icon={PenLine}>Signed deliveries, collections and new bookings will show here.</Quiet>
            ) : (
              <ol className="relative px-5 py-4">
                <span className="absolute top-6 bottom-6 left-[33px] w-px bg-border" aria-hidden />
                {activity.map((a) => {
                  const meta = ACTIVITY_META[a.kind];
                  return (
                    <li key={a.id}>
                      <Link href={a.href} className="group relative flex gap-3 rounded-lg py-2 pr-2 transition-colors hover:bg-muted/50">
                        <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white', meta.className)}>
                          <meta.icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground group-hover:underline">{a.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatRelativeDay(a.at)}
                            {a.detail && ` · ${a.detail}`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_META: Record<'DELIVERED' | 'COLLECTED' | 'BOOKED' | 'SERVICE', { icon: LucideIcon; className: string }> = {
  DELIVERED: { icon: Truck, className: 'bg-violet-100 text-violet-700' },
  COLLECTED: { icon: PackageCheck, className: 'bg-emerald-100 text-emerald-700' },
  BOOKED: { icon: CalendarPlus, className: 'bg-sky-100 text-sky-700' },
  SERVICE: { icon: Wrench, className: 'bg-amber-100 text-amber-700' },
};

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone: Tone;
  href: string;
  progress?: number;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-xl border bg-white p-4 shadow-[var(--shadow-xs)] transition-all outline-none hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', t.soft)}>
          <Icon className={cn('size-4', t.text)} />
        </span>
      </div>
      <span className="tabular mt-3 text-[32px] leading-none font-semibold tracking-tight text-foreground sm:text-[36px]">{value}</span>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', t.dot)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <div className="mt-auto pt-3 pr-5 text-xs text-muted-foreground">{hint}</div>}
      <ArrowUpRight className="absolute right-4 bottom-4 size-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
    </Link>
  );
}

function Card({ title, description, count, action, children }: { title: string; description?: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-[var(--shadow-xs)]">
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            {title}
            {count !== undefined && <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="border-t">{children}</div>
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {children} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Quiet({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 px-5 py-4 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-muted-foreground/60" /> {children}
    </p>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', dot)} />
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-lg leading-tight font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function DaySchedule({ label, date, visits, today }: { label: string; date: string; visits: Visit[]; today: string }) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 bg-muted/30 px-5 py-2">
        <span className="text-xs font-semibold tracking-wider text-foreground uppercase">{label}</span>
        <span className="text-xs text-muted-foreground">{formatDayDate(date)}</span>
        <span className="tabular ml-auto text-xs text-muted-foreground">{visits.length ? plural(visits.length, 'job', 'jobs') : ''}</span>
      </div>
      {visits.length === 0 ? (
        <Quiet icon={CalendarCheck}>Nothing on the run.</Quiet>
      ) : (
        <ol>
          {visits.map((v) => {
            const b = v.lines[0];
            const overdue = v.kind === 'collection' && b.endDate < today;
            const delivery = v.kind === 'delivery';
            return (
              <li key={`${v.kind}-${b.id}`}>
                <Link href={`/bookings/${b.groupId ?? b.id}`} className="group grid grid-cols-[52px_14px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <span className="tabular text-sm font-semibold text-foreground">{v.time ?? <span className="font-normal text-muted-foreground">Any</span>}</span>
                  <span className={cn('size-2.5 justify-self-center rounded-full ring-4', delivery ? 'bg-violet-500 ring-violet-100' : overdue ? 'bg-red-500 ring-red-100' : 'bg-amber-500 ring-amber-100')} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="truncate font-medium text-foreground">{b.customer.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{v.lines.map((l) => l.unit.id).join(' + ')}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{b.deliveryAddress}</span>
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium', delivery ? 'text-violet-700' : overdue ? 'text-red-600' : 'text-amber-700')}>
                    {delivery ? 'Delivery' : overdue ? `Overdue · ${formatDate(b.endDate)}` : 'Collection'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
