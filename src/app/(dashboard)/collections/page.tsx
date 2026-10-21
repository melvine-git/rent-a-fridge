import { getCollectionsDue, getStaff, getUpcomingCollections, getCompletedCollections, getCollectionsFromBookings } from '@/lib/actions';
import { CollectionsView } from './collections-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const [collectionsDue, staff, upcomingCollections, completedCollections, collectionsFromBookings] = await Promise.all([
    getCollectionsDue(),
    getStaff(),
    getUpcomingCollections(),
    getCompletedCollections(),
    getCollectionsFromBookings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" description="Recover units and accessories at the end of each hire" />
      <CollectionsView
        collectionsDue={collectionsDue}
        staff={staff}
        upcomingCollections={upcomingCollections}
        completedCollections={completedCollections}
        collectionsFromBookings={collectionsFromBookings}
      />
    </div>
  );
}
