import { bookingsForCalendar } from '@/lib/actions';
import { BookingsCalendar } from './bookings-calendar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const bookings = await bookingsForCalendar();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[var(--brand-red)]/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--brand-red)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--charcoal)] tracking-tight">Bookings</h1>
              <p className="text-xs sm:text-sm text-[var(--warm-gray-500)]">Manage fridge rental schedule</p>
            </div>
          </div>
        </div>
        <Link href="/bookings/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white font-semibold h-10 sm:h-11 px-5 rounded-xl shadow-sm hover:shadow-md transition-all gap-2">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </div>

      <BookingsCalendar bookings={bookings} />
    </div>
  );
}
