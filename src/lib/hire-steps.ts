import { unitDisplayStatus } from './domain';
import { formatDate } from './format';
import type { BookingWithDetails } from '@/types';

export type LineJob = { type: 'DELIVERY' | 'COLLECTION'; status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'; completedAt?: string; signedBy: string; staff?: string };
export type StepState = 'done' | 'current' | 'todo';
export type HireStep = { title: string; sub?: string; time: string; state: StepState };

/** A booking's life from creation to the unit being back and ready, for the units handled on one visit. */
export function hireSteps(lines: BookingWithDetails[], jobs: Record<string, LineJob[]>, today: string, tomorrow: string): HireStep[] {
  const b = lines[0];
  const js = lines.flatMap((l) => jobs[l.id] ?? []);
  const delivered = js.find((j) => j.type === 'DELIVERY' && j.status === 'COMPLETED');
  const collected = js.find((j) => j.type === 'COLLECTION' && j.status === 'COMPLETED');
  const when = (date: string, time?: string) => `${date <= today ? 'Today' : date === tomorrow ? 'Tomorrow' : formatDate(date)}${time ? ` ${time}` : ''}`;
  const pending = (type: 'DELIVERY' | 'COLLECTION', due: string) => {
    const staff = js.find((j) => j.type === type)?.staff;
    return [due < today && `Missed ${formatDate(due)}`, staff ? `Driver ${staff}` : 'driver not assigned'].filter(Boolean).join(' · ');
  };
  const signed = (j: { signedBy: string }) => (j.signedBy ? `Signed by ${j.signedBy}` : undefined);
  const day = (iso?: string) => (iso ? formatDate(iso.slice(0, 10)) : '—');
  const ready = !!collected && lines.every((l) => unitDisplayStatus(l.unit) === 'AVAILABLE');

  return [
    { title: 'Booking created', sub: lines.map((l) => l.unit.id).join(', '), time: formatDate(b.createdAt), state: 'done' },
    delivered
      ? { title: 'Delivered', sub: signed(delivered), time: day(delivered.completedAt), state: 'done' }
      : { title: 'Delivery', sub: pending('DELIVERY', b.startDate), time: when(b.startDate, b.deliveryTime), state: 'current' },
    collected
      ? { title: 'Collected', sub: signed(collected), time: day(collected.completedAt), state: 'done' }
      : delivered
        ? { title: 'Collection', sub: pending('COLLECTION', b.endDate), time: when(b.endDate, b.collectionTime), state: 'current' }
        : { title: 'Collection', sub: `Due ${formatDate(b.endDate)}`, time: '—', state: 'todo' },
    { title: 'Back at depot', time: collected ? day(collected.completedAt) : '—', state: collected ? 'done' : 'todo' },
    { title: 'Inspected & available', time: ready ? day(collected?.completedAt) : '—', state: ready ? 'done' : 'todo' },
  ];
}
