import { notFound } from 'next/navigation';
import { getCustomerDetail } from '@/lib/actions';
import { CustomerDetailView } from './customer-detail-view';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCustomerDetail(id);
  if (!data) notFound();
  return <CustomerDetailView {...data} />;
}
