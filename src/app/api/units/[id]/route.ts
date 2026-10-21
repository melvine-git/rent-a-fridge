import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = readDb();
  
  const unit = db.units.find(u => u.id === id);
  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  
  // Get unit's booking history
  const bookingHistory = db.bookings
    .filter(b => b.unitId === id)
    .map(b => {
      const customer = db.customers.find(c => c.id === b.customerId);
      return { ...b, customer };
    })
    .filter(b => b.customer)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  
  // Get current booking details if on hire
  let currentBooking = null;
  if (unit.currentBookingId) {
    const booking = db.bookings.find(b => b.id === unit.currentBookingId);
    if (booking) {
      const customer = db.customers.find(c => c.id === booking.customerId);
      currentBooking = { ...booking, customer };
    }
  }
  
  return NextResponse.json({
    unit,
    bookingHistory,
    currentBooking,
  });
}
