'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { AppNotification } from '@/types';

/**
 * Client-side overlay for notification read/dismiss state.
 *
 * The server persists this state in the `notifications` table when it exists.
 * This local mirror keeps the UI consistent (bell badge, panel, dashboard) even
 * before that migration is applied, and makes interactions feel instant. The
 * server stays authoritative for cross-device sync once the table is in place:
 * overrides simply re-apply the same state on top, so the two never conflict.
 */

type Override = { read?: boolean; dismissed?: boolean };

const KEY = 'raf-notification-overrides-v1';
const SERVER_SNAPSHOT: Record<string, Override> = {};

let cache: Record<string, Override> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, Override> {
  if (cache) return cache;
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Override>;
  } catch {
    cache = {};
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Record a read/dismiss change locally; every subscribed component re-renders. */
export function setNotificationOverride(id: string, patch: Override) {
  const cur = read();
  cache = { ...cur, [id]: { ...cur[id], ...patch } };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable — the in-memory copy still applies for this session
  }
  listeners.forEach((cb) => cb());
}

export function useNotificationOverrides(): Record<string, Override> {
  return useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
}

/** Server-derived notifications with local read/dismiss state applied on top. */
export function useMergedNotifications(items: AppNotification[]): AppNotification[] {
  const overrides = useNotificationOverrides();
  return useMemo(
    () =>
      items
        .map((n) => {
          const o = overrides[n.id];
          return o?.read !== undefined ? { ...n, read: o.read } : n;
        })
        .filter((n) => !overrides[n.id]?.dismissed),
    [items, overrides]
  );
}
