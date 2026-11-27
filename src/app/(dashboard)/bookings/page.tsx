import { bookingsForCalendar, getUnitsWithHire, getOverdueActionBookings, getBookingsList } from '@/lib/actions';
import { BookingsWorkspace } from './bookings-workspace';
import { HireBoard, type HireBoardRow } from '@/components/bookings/hire-board';
import { ActionAlerts } from '@/components/notifications/action-alerts';
import { TypedText } from '@/components/app/typed-text';
import { PageHeader } from '@/components/app/page-header';
import { unitDisplayStatus } from '@/lib/domain';
import { toISODate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [bookings, units, overdueBookings, list] = await Promise.all([
    bookingsForCalendar(),
    getUnitsWithHire(),
    getOverdueActionBookings(),
    getBookingsList(),
  ]);

  const rows: HireBoardRow[] = units.map((u) => ({
    id: u.id,
    unitType: u.unitType,
    status: unitDisplayStatus(u),
    hire: u.currentHire && {
      reference: u.currentHire.reference,
      customerName: u.currentHire.customerName,
      startDate: u.currentHire.startDate,
      endDate: u.currentHire.endDate,
      site: u.currentHire.site,
    },
  }));
  const onHireCount = rows.filter((r) => r.status === 'ON_HIRE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description={
          <TypedText
            strings={[
              'Manage your active hires.',
              'Track equipment currently with customers.',
              'Manage upcoming collections.',
            ]}
          />
        }
        meta={
          <span className="tabular rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/15 ring-inset">
            {onHireCount} out on hire
          </span>
        }
      />
      <ActionAlerts overdueBookings={overdueBookings} />
      <BookingsWorkspace bookings={bookings} allUnits={units} list={list} today={toISODate(new Date())} />
      <HireBoard rows={rows} />
    </div>
  );
}
