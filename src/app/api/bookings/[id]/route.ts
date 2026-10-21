import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = readDb();
  
  const booking = db.bookings.find(b => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  
  const customer = db.customers.find(c => c.id === booking.customerId);
  const unit = db.units.find(u => u.id === booking.unitId);
  
  if (!customer || !unit) {
    return NextResponse.json({ error: 'Invalid booking data' }, { status: 500 });
  }
  
  return NextResponse.json({
    ...booking,
    customer,
    unit,
  });
}
