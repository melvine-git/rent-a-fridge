import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types';

type Collection = 'staff' | 'customers' | 'units' | 'bookings' | 'dockets' | 'serviceableComponents';

const TABLES: Record<Collection, string> = {
  staff: 'staff',
  customers: 'customers',
  units: 'units',
  bookings: 'bookings',
  dockets: 'dockets',
  serviceableComponents: 'serviceable_components',
};

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Serialised rows as loaded, so writeDb only saves what changed. */
const loaded = new WeakMap<Database, Record<Collection, Map<string, string>>>();

function snapshot(db: Database): Record<Collection, Map<string, string>> {
  const snap = {} as Record<Collection, Map<string, string>>;
  for (const key of Object.keys(TABLES) as Collection[]) {
    snap[key] = new Map((db[key] ?? []).map((r) => [r.id, JSON.stringify(r)]));
  }
  return snap;
}

export async function readDb(): Promise<Database> {
  const keys = Object.keys(TABLES) as Collection[];
  const results = await Promise.all(
    keys.map((key) => supabase().from(TABLES[key]).select('data').order('seq'))
  );
  const db = { staff: [], customers: [], units: [], bookings: [], dockets: [] } as Database;
  results.forEach(({ data, error }, i) => {
    if (error) throw new Error(`Failed to load ${keys[i]}: ${error.message}`);
    const rows = (data ?? []).map((r) => r.data);
    // No saved list yet means "use the default serviceable components"
    if (keys[i] === 'serviceableComponents') db.serviceableComponents = rows.length ? rows : undefined;
    else (db[keys[i]] as unknown[]) = rows;
  });
  loaded.set(db, snapshot(db));
  return db;
}

export async function writeDb(db: Database): Promise<void> {
  const before = loaded.get(db);
  if (!before) throw new Error('writeDb must be given a database returned by readDb');
  const after = snapshot(db);
  const now = new Date().toISOString();

  await Promise.all(
    (Object.keys(TABLES) as Collection[]).flatMap((key) => {
      const changed = (db[key] ?? [])
        .filter((r) => before[key].get(r.id) !== after[key].get(r.id))
        .map((r) => ({ id: r.id, data: r, updated_at: now }));
      const removed = [...before[key].keys()].filter((id) => !after[key].has(id));
      const ops: PromiseLike<void>[] = [];
      if (changed.length) {
        ops.push(supabase().from(TABLES[key]).upsert(changed).then(({ error }) => {
          if (error) throw new Error(`Failed to save ${key}: ${error.message}`);
        }));
      }
      if (removed.length) {
        ops.push(supabase().from(TABLES[key]).delete().in('id', removed).then(({ error }) => {
          if (error) throw new Error(`Failed to delete ${key}: ${error.message}`);
        }));
      }
      return ops;
    })
  );
  loaded.set(db, after);
}
