import Link from 'next/link';
import { getUnitsWithHire, getOverdueActionBookings, getBookingsList } from '@/lib/actions';
import { BookingsList } from './bookings-list';
import { HireBoard, type HireBoardRow } from '@/components/bookings/hire-board';
import { ActionAlerts } from '@/components/notifications/action-alerts';
import { PageHeader } from '@/components/app/page-header';
import { unitDisplayStatus } from '@/lib/domain';
import { toISODate } from '@/lib/format';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const [units, overdueBookings, list] = await Promise.all([getUnitsWithHire(), getOverdueActionBookings(), getBookingsList()]);

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
        description="Manage your active hires, track equipment currently with customers and manage upcoming collections."
        meta={
          <span className="tabular rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/15 ring-inset">
            {onHireCount} out on hire
          </span>
        }
        actions={
          <Link
            href="/bookings/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-3 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--brand-red-dark)]"
          >
            <Plus className="size-4" /> New booking
          </Link>
        }
      />
      <ActionAlerts overdueBookings={overdueBookings} />
      <HireBoard rows={rows} />
      <BookingsList list={list} today={toISODate(new Date())} />
    </div>
  );
}
