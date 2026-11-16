import 'server-only';

export type LatLng = { lat: number; lng: number };

/** Where the van starts and ends its run. Placeholder until the real yard address is confirmed. */
export const YARD_ADDRESS = process.env.YARD_ADDRESS || 'Belfast City Hall, Belfast BT1 5GS';

// UK postcode, e.g. "BT9 5EG", "bt12 7gh"
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export function extractPostcode(address: string): string | null {
  const m = address.match(POSTCODE_RE);
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : null;
}

const memo = new Map<string, LatLng | null>();

async function lookup(postcode: string): Promise<LatLng | null> {
  if (memo.has(postcode)) return memo.get(postcode)!;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(4000),
    });
    const json = res.ok ? ((await res.json()) as { result?: { latitude: number; longitude: number } }) : null;
    const hit = json?.result ? { lat: json.result.latitude, lng: json.result.longitude } : null;
    // Only remember definite answers; a network failure is retried next time
    if (res.ok || res.status === 404) memo.set(postcode, hit);
    return hit;
  } catch {
    return null;
  }
}

/**
 * Resolve UK postcodes to coordinates via postcodes.io (free, no key, covers NI).
 * Failures are swallowed: callers simply get fewer points on the map.
 */
export async function geocodePostcodes(postcodes: string[]): Promise<Record<string, LatLng>> {
  const wanted = [...new Set(postcodes.map((p) => p.toUpperCase()))];
  const hits = await Promise.all(wanted.map(lookup));
  const out: Record<string, LatLng> = {};
  wanted.forEach((p, i) => {
    if (hits[i]) out[p] = hits[i];
  });
  return out;
}
