const DAY_MS = 86_400_000;

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Treat bare YYYY-MM-DD as a local calendar date, not UTC midnight
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "21 Oct 2026" */
export function formatDate(value?: string | Date, opts: { year?: boolean } = {}): string {
  if (!value) return '—';
  const d = toDate(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(opts.year ?? !sameYear ? { year: 'numeric' } : {}),
  });
}

/** "Wed 21 Oct" */
export function formatDayDate(value: string | Date): string {
  return toDate(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "21 – 28 Oct" or "28 Oct – 4 Nov" */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = toDate(start);
  const e = toDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${formatDate(e)}`;
  }
  return `${formatDate(s)} – ${formatDate(e)}`;
}

/** Whole days from today to the date (negative = past). */
export function daysFromToday(value: string | Date): number {
  return Math.round((startOfDay(toDate(value)).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

export function daysBetween(start: string | Date, end: string | Date): number {
  return Math.round((startOfDay(toDate(end)).getTime() - startOfDay(toDate(start)).getTime()) / DAY_MS) + 1;
}

/** "Today", "Tomorrow", "in 3 days", "2 days ago" */
export function formatRelativeDay(value: string | Date): string {
  const diff = daysFromToday(value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** "+442890123456" -> "+44 28 9012 3456" (UK numbers); otherwise unchanged */
export function formatPhone(phone: string): string {
  const m = phone.replace(/\s+/g, '').match(/^\+44(\d{2})(\d{4})(\d{4})$/);
  if (m) return `+44 ${m[1]} ${m[2]} ${m[3]}`;
  const mobile = phone.replace(/\s+/g, '').match(/^\+44(7\d{3})(\d{6})$/);
  return mobile ? `+44 ${mobile[1]} ${mobile[2]}` : phone;
}

const W3W_RE = /^\/{0,3}(\p{L}+)\.(\p{L}+)\.(\p{L}+)$/u;

/** what3words addresses are three dot-separated words, optionally prefixed with ///. */
export function isValidW3w(value: string): boolean {
  return W3W_RE.test(value.trim());
}

/** Normalise to the canonical "///word.word.word" form, or undefined if blank/invalid. */
export function normalizeW3w(value?: string): string | undefined {
  const m = value?.trim().toLowerCase().match(W3W_RE);
  return m ? `///${m[1]}.${m[2]}.${m[3]}` : undefined;
}

export function w3wUrl(value: string): string {
  return `https://what3words.com/${encodeURIComponent(value.trim().replace(/^\/+/, ''))}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
