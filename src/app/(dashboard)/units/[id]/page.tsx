import { notFound } from 'next/navigation';
import { getUnitDetail } from '@/lib/actions';
import { UnitDetailView, type UnitTab } from './unit-detail-view';

export const dynamic = 'force-dynamic';

const TABS: UnitTab[] = ['overview', 'bom', 'bookings', 'maintenance'];

export default async function UnitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const data = await getUnitDetail(decodeURIComponent(id));
  if (!data) notFound();
  return <UnitDetailView {...data} initialTab={TABS.find((t) => t === tab)} />;
}
