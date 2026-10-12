import { searchCustomers, unitsWithStatus } from '@/lib/actions';
import { NewBookingForm } from './new-booking-form';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage() {
  const customers = await searchCustomers('');
  const allUnits = await unitsWithStatus();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[var(--brand-red)]/10 flex items-center justify-center">
          <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--brand-red)]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--charcoal)] tracking-tight">New Booking</h1>
          <p className="text-xs sm:text-sm text-[var(--warm-gray-500)]">Create a new fridge rental booking</p>
        </div>
      </div>

      <NewBookingForm customers={customers} allUnits={allUnits} />
    </div>
  );
}
