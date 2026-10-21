import { bookingsForCalendar, unitsWithStatus, getOverdueActionBookings } from '@/lib/actions';
import { BookingsCalendar } from './bookings-calendar';
import { ActionAlerts } from '@/components/notifications/action-alerts';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [bookings, allUnits, overdueBookings] = await Promise.all([
    bookingsForCalendar(),
    unitsWithStatus(),
    getOverdueActionBookings(),
  ]);

  const scheduled = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const onHire = bookings.filter((b) => b.status === 'ON_HIRE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description={`${onHire} on hire · ${scheduled} scheduled across ${allUnits.length} units`}
      />

      <ActionAlerts overdueBookings={overdueBookings} />

      <BookingsCalendar bookings={bookings} allUnits={allUnits} />
    </div>
  );
}
