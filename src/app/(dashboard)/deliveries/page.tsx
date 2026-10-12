import { getTomorrowsDeliveries, getTodaysDeliveries, activeHires, getCollectionsDue, getAllStaff } from '@/lib/actions';
import { DeliveriesView } from './deliveries-view';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DeliveriesPage() {
  const [tomorrowDeliveries, todayDeliveries, hires, collectionsDue, staff] = await Promise.all([
    getTomorrowsDeliveries(),
    getTodaysDeliveries(),
    activeHires(),
    getCollectionsDue(),
    getAllStaff(),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[var(--brand-red)]/10 flex items-center justify-center">
          <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--brand-red)]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--charcoal)] tracking-tight">Deliveries</h1>
          <p className="text-xs sm:text-sm text-[var(--warm-gray-500)]">Driver job management</p>
        </div>
      </div>

      <DeliveriesView 
        tomorrowDeliveries={tomorrowDeliveries}
        todayDeliveries={todayDeliveries}
        activeHires={hires}
        collectionsDue={collectionsDue}
        staff={staff}
      />
    </div>
  );
}
