import { searchCustomers, unitsWithStatus } from '@/lib/actions';
import { NewBookingForm } from './new-booking-form';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const [{ customer }, customers, allUnits] = await Promise.all([searchParams, searchCustomers(''), unitsWithStatus()]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Bookings', href: '/bookings' }, { label: 'New booking' }]}
        title="New booking"
        description="Choose the customer and hire dates, then pick an available unit"
      />
      <NewBookingForm customers={customers} allUnits={allUnits} initialCustomerId={customer} />
    </div>
  );
}
