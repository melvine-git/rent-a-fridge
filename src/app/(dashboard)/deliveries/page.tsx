import { getDispatchData } from '@/lib/actions';
import { DeliveriesView } from './deliveries-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function DeliveriesPage() {
  const data = await getDispatchData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Plan the van run and confirm deliveries and collections`}
      />
      <DeliveriesView {...data} />
    </div>
  );
}
