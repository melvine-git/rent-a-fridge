import Link from 'next/link';
import { getDashboardData } from '@/lib/actions';
import { CommandCentre } from '@/components/dashboard/command-centre';
import { unitDisplayStatus } from '@/lib/domain';
import { groupVisits } from '@/lib/jobs';
import { extractPostcode, geocodePostcodes, YARD_ADDRESS, type LatLng } from '@/lib/geo';
import { greeting } from '@/lib/format';
import { previewData } from './preview-data';
import { cn } from '@/lib/utils';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const [data, params] = await Promise.all([getDashboardData(), searchParams]);
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
  const problems = [
    late && `${plural(late, 'delivery is', 'deliveries are')} late`,
    overdue && `${plural(overdue, 'collection is', 'collections are')} overdue`,
    breakdown && `${plural(breakdown, 'unit is', 'units are')} broken down`,
  ].filter(Boolean) as string[];
  const todayJobs =
    groupVisits(deliveries, (b) => b.startDate).filter((l) => l[0].startDate === today).length +
    groupVisits(collections, (b) => b.endDate).filter((l) => l[0].endDate <= today).length;
  const summary = problems.length
    ? `${problems.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    : todayJobs
      ? `Everything is on track. ${plural(todayJobs, 'job', 'jobs')} on today's run.`
      : 'Everything is on track. Nothing on the run today.';

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight text-foreground">{greeting()}</h1>
          <p className={cn('mt-1 text-[15px]', problems.length ? 'text-foreground/80' : 'text-muted-foreground')}>{summary}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={preview ? '/dashboard' : '/dashboard?preview=1'}
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {preview ? 'Show live data' : 'Preview with sample day'}
          </Link>
          <Link
            href="/deliveries"
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

      <CommandCentre {...centre} coords={coords} yard={yard} />
    </div>
  );
}
