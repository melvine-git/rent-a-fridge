import { notFound } from 'next/navigation';
import { getUnitDetail } from '@/lib/actions';
import { UnitDetailView } from './unit-detail-view';

export const dynamic = 'force-dynamic';

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getUnitDetail(decodeURIComponent(id));
  if (!data) notFound();
  return <UnitDetailView {...data} />;
}
