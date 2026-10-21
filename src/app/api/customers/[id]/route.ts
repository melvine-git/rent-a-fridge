import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = readDb();
  
  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }
  
  // Get customer's bookings
  const bookings = db.bookings
    .filter(b => b.customerId === id)
    .map(b => {
      const unit = db.units.find(u => u.id === b.unitId);
      return { ...b, unit };
    })
    .filter(b => b.unit)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  
  // Get preferred unit details if exists
  let preferredUnit = null;
  if (customer.preferences?.preferredUnitId) {
    preferredUnit = db.units.find(u => u.id === customer.preferences?.preferredUnitId);
  }
  
  return NextResponse.json({
    customer,
    bookings,
    preferredUnit,
  });
}
