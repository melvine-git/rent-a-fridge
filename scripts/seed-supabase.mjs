// One-off import of data/db.json into Supabase.
// Run with: node --env-file=.env.local scripts/seed-supabase.mjs
// Refuses to run if any table already has rows, so it can't overwrite live data.
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const db = JSON.parse(readFileSync('data/db.json', 'utf8'));
const tables = {
  staff: db.staff,
  customers: db.customers,
  units: db.units,
  bookings: db.bookings,
  dockets: db.dockets,
  serviceable_components: db.serviceableComponents ?? [],
};

for (const table of Object.keys(tables)) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message} (has the migration in supabase/migrations been run?)`);
  if (count) {
    console.error(`${table} already has ${count} rows; nothing imported.`);
    process.exit(1);
  }
}

for (const [table, rows] of Object.entries(tables)) {
  if (!rows.length) continue;
  const { error } = await supabase.from(table).insert(rows.map((r) => ({ id: r.id, data: r })));
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows imported`);
}
console.log('Done.');
