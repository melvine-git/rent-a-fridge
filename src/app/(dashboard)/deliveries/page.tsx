import { getTomorrowsDeliveries, getTodaysDeliveries, activeHires, getCollectionsDue, getAllStaff, getAllDockets, getUpcomingDeliveries } from '@/lib/actions';
import { DeliveriesView } from './deliveries-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function DeliveriesPage() {
  const [tomorrowDeliveries, todayDeliveries, hires, collectionsDue, staff, allDockets, upcomingDockets] = await Promise.all([
    getTomorrowsDeliveries(),
    getTodaysDeliveries(),
    activeHires(),
    getCollectionsDue(),
    getAllStaff(),
    getAllDockets(),
    getUpcomingDeliveries(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Plan driver runs and confirm deliveries and collections`}
      />

      <DeliveriesView
        tomorrowDeliveries={tomorrowDeliveries}
        todayDeliveries={todayDeliveries}
        activeHires={hires}
        collectionsDue={collectionsDue}
        staff={staff}
        allDockets={allDockets}
        upcomingDockets={upcomingDockets}
      />
    </div>
  );
}
