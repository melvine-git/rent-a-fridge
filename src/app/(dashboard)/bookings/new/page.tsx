import { searchCustomers, unitsWithStatus } from '@/lib/actions';
import { NewBookingForm } from './new-booking-form';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ customer?: string; unit?: string; start?: string }> }) {
  const [{ customer, unit, start }, customers, allUnits] = await Promise.all([searchParams, searchCustomers(''), unitsWithStatus()]);
  const startDate = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Bookings', href: '/bookings' }, { label: 'New booking' }]}
        title="New booking"
        description="Choose the customer and hire dates, then pick one or more available units"
      />
      <NewBookingForm
        customers={customers}
        allUnits={allUnits}
        initialCustomerId={customer}
        initialUnitId={allUnits.some((u) => u.id === unit) ? unit : undefined}
        initialStartDate={startDate}
      />
    </div>
  );
}
