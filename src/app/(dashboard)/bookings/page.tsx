import { bookingsForCalendar, unitsWithStatus, getOverdueActionBookings, getBookingsList } from '@/lib/actions';
import { BookingsWorkspace } from './bookings-workspace';
import { ActionAlerts } from '@/components/notifications/action-alerts';
import { PageHeader } from '@/components/app/page-header';
import { toISODate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [bookings, allUnits, overdueBookings, list] = await Promise.all([bookingsForCalendar(), unitsWithStatus(), getOverdueActionBookings(), getBookingsList()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Plan the fleet on the timeline, or search every booking in the list" />
      <ActionAlerts overdueBookings={overdueBookings} />
      <BookingsWorkspace bookings={bookings} allUnits={allUnits} list={list} today={toISODate(new Date())} />
    </div>
  );
}
