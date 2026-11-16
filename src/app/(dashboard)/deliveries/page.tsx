import { existsSync } from 'node:fs';
import path from 'node:path';
import { getDispatchData } from '@/lib/actions';
import { extractPostcode, geocodePostcodes, YARD_ADDRESS, type LatLng } from '@/lib/geo';
import { DeliveriesView } from './deliveries-view';

export const dynamic = 'force-dynamic';

// Drop a photo with one of these names into /public to show it behind the top of the page
const HERO_FILES = ['dispatch-hero.webp', 'dispatch-hero.jpg', 'dispatch-hero.png'];

export default async function DeliveriesPage() {
  // Four weeks ahead, so the day picker can step forward a week at a time
  const data = await getDispatchData(28);

  // Map positions for "Optimise", which orders a day's stops by driving distance from the yard
  const lines = [...data.deliveries, ...data.collections];
  const postcodeOf = new Map(lines.map((l) => [l.id, extractPostcode(l.deliveryAddress)]));
  const yardPostcode = extractPostcode(YARD_ADDRESS);
  const geo = await geocodePostcodes([...postcodeOf.values(), yardPostcode].filter((p): p is string => !!p));
  const coords: Record<string, LatLng> = {};
  for (const [id, pc] of postcodeOf) if (pc && geo[pc]) coords[id] = geo[pc];
  const yard = yardPostcode ? (geo[yardPostcode] ?? null) : null;

  const heroFile = HERO_FILES.find((f) => existsSync(path.join(process.cwd(), 'public', f)));

  return <DeliveriesView {...data} coords={coords} yard={yard} heroImage={heroFile ? `/${heroFile}` : undefined} />;
}
