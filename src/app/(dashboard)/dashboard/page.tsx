import Link from 'next/link';
import { getDashboardData, getShellData } from '@/lib/actions';
import { CommandCentre } from '@/components/dashboard/command-centre';
import { GreetingHero, type HeroIssue } from '@/components/dashboard/greeting-hero';
import { DashboardMotion } from '@/components/dashboard/dashboard-motion';
import { HeroBanner } from '@/components/dashboard/hero-banner';
import { StatCards } from '@/components/dashboard/stat-cards';
import { FleetOverviewCard } from '@/components/dashboard/fleet-overview-card';
import { UpcomingBookingsCard, type UpcomingBookingRow } from '@/components/dashboard/upcoming-bookings-card';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { bookingGroupStatus, unitDisplayStatus } from '@/lib/domain';
import { groupVisits } from '@/lib/jobs';
import { extractPostcode, geocodePostcodes, YARD_ADDRESS, type LatLng } from '@/lib/geo';
import { greeting } from '@/lib/format';
import { previewData } from './preview-data';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const [data, shell, params] = await Promise.all([getDashboardData(), getShellData(), searchParams]);
  const { units, deliveries, collections, upcoming, today, tomorrow } = data;
  const preview = params.preview === '1';

  // Map: real data, or a sample Belfast day with ?preview=1
  const centre = preview
    ? previewData(units, today, tomorrow)
    : {
        today,
        tomorrow,
        units,
        hires: data.hires,
        deliveries: upcoming.flatMap((u) => u.lines).filter((l) => l.startDate <= tomorrow),
        collections,
        doneToday: data.doneToday,
        delivered: data.delivered,
        nextOut: data.nextOut,
        jobs: data.jobs,
      };
  const mapLines = [...centre.hires, ...centre.deliveries, ...centre.collections, ...centre.doneToday.map((d) => d.line)];
  const postcodeOf = new Map(mapLines.map((l) => [l.id, extractPostcode(l.deliveryAddress)]));
  const yardPostcode = extractPostcode(YARD_ADDRESS);
  const geo = await geocodePostcodes([...postcodeOf.values(), yardPostcode].filter((p): p is string => !!p));
  const coords: Record<string, LatLng> = {};
  for (const [id, pc] of postcodeOf) if (pc && geo[pc]) coords[id] = geo[pc];
  const yard = yardPostcode && geo[yardPostcode] ? { ...geo[yardPostcode], address: YARD_ADDRESS } : null;

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
      <div className="space-y-6 lg:space-y-8">
        <header data-motion className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <GreetingHero
            date={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            greeting={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
            issues={issues}
            jobsToday={todayJobs}
          />
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href={preview ? '/dashboard' : '/dashboard?preview=1'}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {preview ? 'Show live data' : 'Preview with sample day'}
            </Link>
            <Link
              href="/dispatch"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3.5 text-sm font-medium shadow-[var(--shadow-xs)] transition-colors hover:bg-muted"
            >
              <Truck className="size-4" /> Open dispatch
            </Link>
          </div>
        </header>

        {preview && (
          <p className="-mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 lg:-mt-4">
            <b className="font-semibold">Preview:</b> the map and its panels show a made-up Belfast day so you can see the design. Nothing is saved.
          </p>
        )}

        <HeroBanner />

        <StatCards stats={stats} />

        <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
          <div className="lg:col-span-2">
            <FleetOverviewCard slices={slices} total={units.length} />
          </div>
          <div className="lg:col-span-3">
            <UpcomingBookingsCard rows={upcomingRows} />
          </div>
        </div>

        <AttentionPanel items={attention} />

        <div data-motion>
          <CommandCentre {...centre} coords={coords} yard={yard} driver={data.driver ? { name: data.driver.name, phone: data.driver.phone } : null} />
        </div>
      </div>
    </DashboardMotion>
  );
}
