import type { Booking } from '@/types';

export const bookingRef = (b: Pick<Booking, 'id' | 'groupId'>) => b.groupId ?? b.id;

/**
 * Group unit lines that belong to the same booking and happen on the same day, so one
 * visit (one card, one signature) covers all of them. Order of first appearance is kept.
 */
export function groupVisits<T extends Booking>(list: T[], date: (b: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const b of list) {
    const key = `${bookingRef(b)}|${date(b)}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.values()];
}

/** The lines in `pool` that go on the same visit as `b` (including `b`). */
export function visitOf<T extends Booking>(b: T, pool: T[], date: (b: T) => string): T[] {
  const same = pool.filter((o) => bookingRef(o) === bookingRef(b) && date(o) === date(b));
  return same.length ? same : [b];
}
