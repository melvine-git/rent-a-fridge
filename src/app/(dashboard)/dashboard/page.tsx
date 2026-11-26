import Link from 'next/link';
import { getDashboardData, getShellData } from '@/lib/actions';
import { GreetingHero, type HeroIssue } from '@/components/dashboard/greeting-hero';
import { DashboardMotion } from '@/components/dashboard/dashboard-motion';
import { HeroBanner } from '@/components/dashboard/hero-banner';
import { StatCards } from '@/components/dashboard/stat-cards';
import { FleetOverviewCard } from '@/components/dashboard/fleet-overview-card';
import { FleetManagement, type FleetRow } from '@/components/dashboard/fleet-management';
import { UpcomingBookingsCard, type UpcomingBookingRow } from '@/components/dashboard/upcoming-bookings-card';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { bookingGroupStatus, unitDisplayStatus } from '@/lib/domain';
import { groupVisits } from '@/lib/jobs';
import { greeting } from '@/lib/format';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const [data, shell] = await Promise.all([getDashboardData(), getShellData()]);
  const { units, deliveries, collections, upcoming, today } = data;

  // One-line summary of the day under the greeting
  const late = upcoming.filter((u) => u.startDate < today).length;
  const overdue = collections.filter((b) => b.endDate < today).length;
  const breakdown = units.filter((u) => unitDisplayStatus(u) === 'BREAKDOWN').length;
  const issues: HeroIssue[] = [
    late ? { label: `${plural(late, 'delivery', 'deliveries')} late`, href: '/dispatch', tone: 'danger' as const } : null,
    overdue ? { label: `${plural(overdue, 'collection', 'collections')} overdue`, href: '/dispatch', tone: 'warning' as const } : null,
    breakdown ? { label: `${plural(breakdown, 'unit', 'units')} broken down`, href: '/units', tone: 'danger' as const } : null,
  ].filter((x) => x !== null);
  const todayJobs =
    groupVisits(deliveries, (b) => b.startDate).filter((l) => l[0].startDate <= today).length +
    groupVisits(collections, (b) => b.endDate).filter((l) => l[0].endDate <= today).length;

  // Fleet statistics — counted from live unit records and their display status
  const display = units.map((u) => unitDisplayStatus(u));
  const stats = {
    total: units.length,
    onHire: display.filter((s) => s === 'ON_HIRE').length,
    maintenance: display.filter((s) => s === 'MAINTENANCE').length,
    brokenDown: display.filter((s) => s === 'BREAKDOWN').length,
  };
  const available = display.filter((s) => s === 'AVAILABLE').length;
  const slices = [
    { label: 'Available', value: available, color: '#16A34A' },
    { label: 'On hire', value: stats.onHire, color: '#2563EB' },
    { label: 'Under maintenance', value: stats.maintenance, color: '#F59E0B' },
    { label: 'Broken down', value: stats.brokenDown, color: '#3A3734' },
  ];

  // Fleet rows — on-hire units show their hire site; everything else is in the yard
  const siteByUnit = new Map(data.hires.map((h) => [h.unitId, h.deliveryAddress]));
  const fleetRows: FleetRow[] = [...units]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({
      id: u.id,
      unitType: u.unitType,
      status: unitDisplayStatus(u),
      location: siteByUnit.get(u.id),
    }));

  // Upcoming bookings — already one row per booking (grouped by reference), soonest first
  const upcomingRows: UpcomingBookingRow[] = upcoming.slice(0, 5).map((u) => ({
    reference: u.reference,
    customer: u.lines[0].customer.name,
    startDate: u.startDate,
    status: bookingGroupStatus(u.lines.map((l) => l.status)),
    late: u.startDate < today,
  }));

  // Attention Required — the same derived notifications the bell shows, worst first
  const attention = shell.notifications.slice(0, 5);

  // No login system exists in the app; greet the first office staff member on record
  const operator = data.staff.find((s) => s.role === 'MANAGER' || s.role === 'ADMIN') ?? data.staff[0];
  const firstName = operator?.name.split(' ')[0];

  return (
    <DashboardMotion>
      <div className="space-y-5 lg:space-y-6">
        <header data-motion className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <GreetingHero
            date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            day={new Date().toLocaleDateString('en-GB', { weekday: 'long' })}
            greeting={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
            issues={issues}
            jobsToday={todayJobs}
          />
          <Link
            href="/dispatch"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border bg-white px-3.5 text-sm font-medium shadow-[var(--shadow-xs)] transition-colors hover:bg-muted sm:self-auto"
          >
            <Truck className="size-4" /> Open dispatch
          </Link>
        </header>

        <HeroBanner />

        <StatCards stats={stats} />

        <div className="grid items-start gap-4 lg:grid-cols-5 lg:gap-6">
          <div className="space-y-4 lg:col-span-3 lg:space-y-5">
            <FleetManagement rows={fleetRows} />
            <FleetOverviewCard slices={slices} total={units.length} />
          </div>
          <div className="space-y-4 lg:col-span-2 lg:space-y-5">
            <UpcomingBookingsCard rows={upcomingRows} />
            <AttentionPanel items={attention} />
          </div>
        </div>
      </div>
    </DashboardMotion>
  );
}
