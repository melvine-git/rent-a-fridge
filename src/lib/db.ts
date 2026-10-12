import 'server-only';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Database } from '@/types';

const DB_PATH = join(process.cwd(), 'data', 'db.json');

export function readDb(): Database {
  if (!existsSync(DB_PATH)) {
    const empty: Database = {
      staff: [],
      customers: [],
      units: [],
      bookings: [],
      dockets: [],
    };
    return empty;
  }
  const raw = readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw) as Database;
}

export function writeDb(db: Database): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}
