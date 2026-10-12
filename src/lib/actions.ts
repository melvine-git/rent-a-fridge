'use server';

import { revalidatePath } from 'next/cache';
import { readDb, writeDb } from './db';
import type {
  Customer,
  Booking,
  Unit,
  DeliveryDocket,
  CreateBookingInput,
  MarkDeliveredInput,
  MarkCollectedInput,
  UnitSpec,
  UnitStatus,
  BookingStatus,
} from '@/types';

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

// Helper to get today's date in YYYY-MM-DD
function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper to get tomorrow's date in YYYY-MM-DD
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Check if date ranges overlap
function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 <= end2 && end1 >= start2;
}

// ============ CUSTOMER ACTIONS ============

export async function searchCustomers(query: string): Promise<Customer[]> {
  const db = readDb();
  const q = query.toLowerCase().trim();
  if (!q) return db.customers;
  return db.customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email?.toLowerCase().includes(q)
  );
}

export async function getCustomerHistory(
  customerId: string
): Promise<Booking[]> {
  const db = readDb();
  return db.bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function addCustomer(
  data: Omit<Customer, 'id' | 'createdAt'>
): Promise<Customer> {
  const db = readDb();
  const customer: Customer = {
    id: generateId('cust'),
    ...data,
    createdAt: today(),
  };
  db.customers.push(customer);
  writeDb(db);
  revalidatePath('/');
  return customer;
}

// ============ UNIT/AVAILABILITY ACTIONS ============

export async function getAvailableUnits(
  startDate: string,
  endDate: string,
  spec?: UnitSpec
): Promise<Unit[]> {
  const db = readDb();

  return db.units.filter((unit) => {
    // Exclude units in maintenance
    if (unit.status === 'MAINTENANCE') return false;

    // Exclude units currently on hire
    if (unit.status === 'ON_HIRE') return false;

    // Check for overlapping bookings (CONFIRMED or ON_HIRE)
    const hasOverlap = db.bookings.some(
      (b) =>
        b.unitId === unit.id &&
        (b.status === 'CONFIRMED' || b.status === 'ON_HIRE') &&
        datesOverlap(startDate, endDate, b.startDate, b.endDate)
    );
    if (hasOverlap) return false;

    // Apply spec filters
    if (spec?.size && unit.size !== spec.size) return false;
    if (spec?.powerType && unit.powerType !== spec.powerType) return false;

    return true;
  });
}

export async function getMatchingUnits(spec: UnitSpec): Promise<Unit[]> {
  const db = readDb();
  return db.units.filter((unit) => {
    if (unit.status !== 'AVAILABLE') return false;
    if (spec.size && unit.size !== spec.size) return false;
    if (spec.powerType && unit.powerType !== spec.powerType) return false;
    return true;
  });
}

export async function getPreviousUnit(customerId: string): Promise<Unit | null> {
  const db = readDb();
  const customerBookings = db.bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (customerBookings.length === 0) return null;

  const lastUnitId = customerBookings[0].unitId;
  return db.units.find((u) => u.id === lastUnitId) || null;
}

// ============ BOOKING ACTIONS ============

export async function createBooking(
  input: CreateBookingInput
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const db = readDb();

  // Server-side re-validation - cannot be bypassed
  const unit = db.units.find((u) => u.id === input.unitId);
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }

  if (unit.status === 'MAINTENANCE') {
    return { success: false, error: 'Unit is under maintenance' };
  }

  if (unit.status === 'ON_HIRE') {
    return { success: false, error: 'Unit is currently on hire' };
  }

  // Check for overlapping bookings
  const hasOverlap = db.bookings.some(
    (b) =>
      b.unitId === input.unitId &&
      (b.status === 'CONFIRMED' || b.status === 'ON_HIRE') &&
      datesOverlap(input.startDate, input.endDate, b.startDate, b.endDate)
  );

  if (hasOverlap) {
    return { success: false, error: 'Unit has conflicting booking' };
  }

  // Validate customer exists
  const customer = db.customers.find((c) => c.id === input.customerId);
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }

  // Validate power compatibility
  if (input.powerAvailable === 'STANDARD' && unit.powerType === 'INDUSTRIAL') {
    return { success: false, error: 'Unit requires industrial power' };
  }

  const booking: Booking = {
    id: generateId('book'),
    ...input,
    status: 'CONFIRMED',
    createdAt: today(),
  };

  db.bookings.push(booking);
  writeDb(db);
  revalidatePath('/');

  return { success: true, booking };
}

// ============ DELIVERY ACTIONS ============

export async function getTomorrowsDeliveries(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = readDb();
  const tomorrowDate = tomorrow();

  return db.bookings
    .filter((b) => b.status === 'CONFIRMED' && b.startDate === tomorrowDate)
    .map((b) => ({
      ...b,
      customer: db.customers.find((c) => c.id === b.customerId)!,
      unit: db.units.find((u) => u.id === b.unitId)!,
    }));
}

export async function getTodaysDeliveries(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = readDb();
  const todayDate = today();

  return db.bookings
    .filter((b) => b.status === 'CONFIRMED' && b.startDate === todayDate)
    .map((b) => ({
      ...b,
      customer: db.customers.find((c) => c.id === b.customerId)!,
      unit: db.units.find((u) => u.id === b.unitId)!,
    }));
}

export async function getCollectionsDue(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = readDb();
  const todayDate = today();

  return db.bookings
    .filter((b) => b.status === 'ON_HIRE' && b.endDate <= todayDate)
    .map((b) => ({
      ...b,
      customer: db.customers.find((c) => c.id === b.customerId)!,
      unit: db.units.find((u) => u.id === b.unitId)!,
    }));
}

export async function markDelivered(
  input: MarkDeliveredInput
): Promise<{ success: boolean; docket?: DeliveryDocket; error?: string }> {
  const db = readDb();

  const booking = db.bookings.find((b) => b.id === input.bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status !== 'CONFIRMED') {
    return { success: false, error: 'Booking is not in CONFIRMED status' };
  }

  const unit = db.units.find((u) => u.id === booking.unitId);
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }

  // Create docket
  const docket: DeliveryDocket = {
    id: generateId('dock'),
    bookingId: booking.id,
    unitId: unit.id,
    type: 'DELIVERY',
    date: today(),
    staffId: input.staffId,
    checklist: input.checklist,
    tempSet: input.tempSet,
    damageNotes: input.damageNotes,
    signedBy: input.signedBy,
    photoUrls: input.photoUrls,
    completedAt: new Date().toISOString(),
  };

  // Update booking status
  booking.status = 'ON_HIRE';
  booking.deliveryDocketId = docket.id;

  // Update unit status
  unit.status = 'ON_HIRE';
  unit.currentBookingId = booking.id;

  db.dockets.push(docket);
  writeDb(db);
  revalidatePath('/');

  return { success: true, docket };
}

export async function markCollected(
  input: MarkCollectedInput
): Promise<{ success: boolean; docket?: DeliveryDocket; error?: string }> {
  const db = readDb();

  const booking = db.bookings.find((b) => b.id === input.bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status !== 'ON_HIRE') {
    return { success: false, error: 'Booking is not in ON_HIRE status' };
  }

  const unit = db.units.find((u) => u.id === booking.unitId);
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }

  // Create docket
  const docket: DeliveryDocket = {
    id: generateId('dock'),
    bookingId: booking.id,
    unitId: unit.id,
    type: 'COLLECTION',
    date: today(),
    staffId: input.staffId,
    checklist: input.checklist,
    tempSet: input.tempSet,
    damageNotes: input.damageNotes,
    signedBy: input.signedBy,
    photoUrls: input.photoUrls,
    completedAt: new Date().toISOString(),
  };

  // Update booking status
  booking.status = 'COLLECTED';
  booking.collectionDocketId = docket.id;

  // Update unit status
  unit.status = 'AVAILABLE';
  unit.currentBookingId = undefined;

  db.dockets.push(docket);
  writeDb(db);
  revalidatePath('/');

  return { success: true, docket };
}

// ============ DATA SELECTORS ============

export async function bookingsForCalendar(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = readDb();
  return db.bookings
    .filter((b) => b.status === 'CONFIRMED' || b.status === 'ON_HIRE')
    .map((b) => ({
      ...b,
      customer: db.customers.find((c) => c.id === b.customerId)!,
      unit: db.units.find((u) => u.id === b.unitId)!,
    }));
}

export async function tomorrowDeliveries(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  return getTomorrowsDeliveries();
}

export async function activeHires(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = readDb();
  return db.bookings
    .filter((b) => b.status === 'ON_HIRE')
    .map((b) => ({
      ...b,
      customer: db.customers.find((c) => c.id === b.customerId)!,
      unit: db.units.find((u) => u.id === b.unitId)!,
    }));
}

export async function unitsWithStatus(
  status?: UnitStatus
): Promise<Unit[]> {
  const db = readDb();
  if (!status) return db.units;
  return db.units.filter((u) => u.status === status);
}

export async function getAllStaff() {
  const db = readDb();
  return db.staff;
}

export async function getUnit(unitId: string): Promise<Unit | null> {
  const db = readDb();
  return db.units.find((u) => u.id === unitId) || null;
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const db = readDb();
  return db.bookings.find((b) => b.id === bookingId) || null;
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const db = readDb();
  return db.customers.find((c) => c.id === customerId) || null;
}
