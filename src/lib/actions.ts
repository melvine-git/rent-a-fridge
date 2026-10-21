'use server';

import { revalidatePath } from 'next/cache';
import { readDb, writeDb } from './db';
import { saveImage, deleteImage, IMAGE_TYPES, MAX_UPLOAD_BYTES } from './uploads';
import type {
  Customer,
  CustomerAddress,
  CustomerPreferences,
  Booking,
  Unit,
  UnitSpecifications,
  BOMComponent,
  MaintenanceRecord,
  DeliveryDocket,
  DeliveryChecklist,
  CreateBookingInput,
  MarkDeliveredInput,
  MarkCollectedInput,
  UnitSpec,
  UnitStatus,
  UnitType,
  UnitSize,
  PowerType,
  BookingStatus,
  Staff,
  AppNotification,
  BookingWithDetails,
  CustomerWithStats,
  ShellData,
  UnitWithHire,
  UpdateBookingInput,
  ServiceableComponent,
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

type Db = ReturnType<typeof readDb>;

const ACTIVE_STATUSES: BookingStatus[] = ['CONFIRMED', 'ON_HIRE'];

function blankChecklist(tempSetting = 0): DeliveryChecklist {
  return {
    unitClean: false,
    doorsSealed: false,
    tempVerified: false,
    powerConnected: false,
    tempSetting,
    powerSupplyChecked: false,
    powerCableConnected: false,
    hitchLockSecured: false,
    wheelClampSecured: false,
    doorLockSecured: false,
  };
}

function defaultDriverId(db: Db): string {
  return db.staff.find((s) => s.role === 'DRIVER')?.id ?? db.staff[0]?.id ?? '';
}

/** Returns a reason the unit can't take this hire, or null if it can. */
function unitConflict(db: Db, unitId: string, startDate: string, endDate: string, ignoreBookingId?: string): string | null {
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return 'Unit not found';
  if (unit.status === 'MAINTENANCE') return 'Unit is under maintenance';
  const clash = db.bookings.some(
    (b) =>
      b.id !== ignoreBookingId &&
      b.unitId === unitId &&
      ACTIVE_STATUSES.includes(b.status) &&
      datesOverlap(startDate, endDate, b.startDate, b.endDate)
  );
  return clash ? 'Unit has a conflicting booking for these dates' : null;
}

/** Scheduled job for a booking, creating it if it doesn't exist yet. */
function ensureScheduledDocket(db: Db, booking: Booking, type: DeliveryDocket['type']): DeliveryDocket {
  const existing = db.dockets.find((d) => d.bookingId === booking.id && d.type === type && d.status !== 'COMPLETED');
  if (existing) return existing;
  const delivery = db.dockets.find((d) => d.id === booking.deliveryDocketId);
  const checklist = blankChecklist(type === 'DELIVERY' ? booking.tempRequired : 0);
  if (type === 'COLLECTION' && delivery) {
    // Carry over what was left on site so the driver knows what to recover
    checklist.hitchLockSecured = delivery.checklist.hitchLockSecured;
    checklist.wheelClampSecured = delivery.checklist.wheelClampSecured;
    checklist.doorLockSecured = delivery.checklist.doorLockSecured;
    checklist.cableLengthUsed = delivery.checklist.cableLengthUsed;
  }
  const docket: DeliveryDocket = {
    id: generateId(type === 'DELIVERY' ? 'del' : 'col'),
    bookingId: booking.id,
    unitId: booking.unitId,
    type,
    scheduledDate: type === 'DELIVERY' ? booking.startDate : booking.endDate,
    scheduledTime: type === 'DELIVERY' ? booking.deliveryTime : booking.collectionTime,
    staffId: defaultDriverId(db),
    checklist,
    tempSet: checklist.tempSetting,
    signedBy: '',
    photoUrls: [],
    what3wordsAddress: booking.what3wordsAddress,
    status: 'SCHEDULED',
  };
  db.dockets.push(docket);
  return docket;
}

/**
 * Bookings created before jobs were auto-scheduled have no job records. Create the
 * missing open job (delivery for confirmed, collection for on hire). Returns true if
 * anything changed so callers can persist.
 */
function backfillOpenJobs(db: Db): boolean {
  let changed = false;
  for (const b of db.bookings) {
    const type = b.status === 'CONFIRMED' ? 'DELIVERY' : b.status === 'ON_HIRE' ? 'COLLECTION' : null;
    if (type && !db.dockets.some((d) => d.bookingId === b.id && d.type === type && d.status !== 'COMPLETED') && !(type === 'COLLECTION' && b.collectionDocketId)) {
      ensureScheduledDocket(db, b, type);
      changed = true;
    }
  }
  return changed;
}

function readDbWithJobs(): Db {
  const db = readDb();
  if (backfillOpenJobs(db)) writeDb(db);
  return db;
}

/** Marks a job complete and moves the booking/unit to the next stage. */
function finaliseDocket(db: Db, docket: DeliveryDocket) {
  docket.completedAt = new Date().toISOString();
  docket.status = 'COMPLETED';
  const booking = db.bookings.find((b) => b.id === docket.bookingId);
  const unit = db.units.find((u) => u.id === docket.unitId);
  if (!booking || !unit) return;
  if (docket.type === 'DELIVERY') {
    booking.status = 'ON_HIRE';
    booking.deliveryDocketId = docket.id;
    unit.status = 'ON_HIRE';
    unit.currentBookingId = booking.id;
    ensureScheduledDocket(db, booking, 'COLLECTION');
  } else {
    booking.status = 'COLLECTED';
    booking.collectionDocketId = docket.id;
    unit.status = 'AVAILABLE';
    unit.currentBookingId = undefined;
  }
}

function completeJob(type: DeliveryDocket['type'], input: MarkDeliveredInput): { success: boolean; docket?: DeliveryDocket; error?: string } {
  const db = readDb();
  const booking = db.bookings.find((b) => b.id === input.bookingId);
  if (!booking) return { success: false, error: 'Booking not found' };
  const expected: BookingStatus = type === 'DELIVERY' ? 'CONFIRMED' : 'ON_HIRE';
  if (booking.status !== expected) {
    return { success: false, error: type === 'DELIVERY' ? 'Booking is not awaiting delivery' : 'Booking is not on hire' };
  }
  if (!db.units.some((u) => u.id === booking.unitId)) return { success: false, error: 'Unit not found' };
  if (!input.signedBy.trim()) return { success: false, error: 'Customer sign-off is required' };

  const docket = ensureScheduledDocket(db, booking, type);
  Object.assign(docket, {
    staffId: input.staffId || docket.staffId,
    checklist: { ...docket.checklist, ...input.checklist },
    tempSet: input.tempSet,
    damageNotes: input.damageNotes,
    signedBy: input.signedBy.trim(),
    signatureData: input.signatureData,
    what3wordsAddress: input.what3wordsAddress || docket.what3wordsAddress,
    photoUrls: input.photoUrls,
  });
  finaliseDocket(db, docket);
  writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true, docket };
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

export async function addCustomerAddress(
  customerId: string,
  data: Omit<CustomerAddress, 'id'>
): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
  const db = readDb();
  const customer = db.customers.find(c => c.id === customerId);
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  
  const address: CustomerAddress = {
    id: generateId('addr'),
    ...data,
  };
  
  if (!customer.addresses) {
    customer.addresses = [];
  }
  customer.addresses.push(address);
  writeDb(db);
  revalidatePath('/');
  return { success: true, address };
}

export async function getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const db = readDb();
  const customer = db.customers.find(c => c.id === customerId);
  if (!customer) return [];
  
  // Return primary address plus any additional addresses
  const addresses: CustomerAddress[] = [
    { id: 'primary', label: 'Primary Address', address: customer.address, isDefault: true }
  ];
  if (customer.addresses) {
    addresses.push(...customer.addresses);
  }
  return addresses;
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const db = readDb();
  return db.customers.find(c => c.id === customerId) || null;
}

export async function getCustomerBookings(customerId: string): Promise<(Booking & { unit: Unit })[]> {
  const db = readDb();
  return db.bookings
    .filter(b => b.customerId === customerId)
    .map(b => {
      const unit = db.units.find(u => u.id === b.unitId);
      return { ...b, unit: unit! };
    })
    .filter(b => b.unit)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function updateCustomer(
  customerId: string,
  data: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const db = readDb();
  const index = db.customers.findIndex(c => c.id === customerId);
  
  if (index === -1) {
    return { success: false, error: 'Customer not found' };
  }
  
  db.customers[index] = {
    ...db.customers[index],
    ...data,
  };
  
  writeDb(db);
  revalidatePath('/');
  return { success: true, customer: db.customers[index] };
}

export async function updateCustomerPreferences(
  customerId: string,
  preferences: CustomerPreferences
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const customer = db.customers.find(c => c.id === customerId);
  
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  
  customer.preferences = { ...customer.preferences, ...preferences };
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const customer = db.customers.find(c => c.id === customerId);
  
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  
  if (!customer.addresses) {
    return { success: false, error: 'Address not found' };
  }
  
  customer.addresses = customer.addresses.filter(a => a.id !== addressId);
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

// ============ UNIT/AVAILABILITY ACTIONS ============

export async function getAvailableUnits(
  startDate: string,
  endDate: string,
  spec?: UnitSpec,
  ignoreBookingId?: string
): Promise<Unit[]> {
  const db = readDb();

  return db.units.filter((unit) => {
    // Units on hire are only unavailable for dates that overlap their current hire
    if (unitConflict(db, unit.id, startDate, endDate, ignoreBookingId)) return false;

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

export async function getUnitsByType(unitType?: UnitType): Promise<Unit[]> {
  const db = readDb();
  if (!unitType) return db.units;
  return db.units.filter(u => u.unitType === unitType);
}

export async function getOverdueActionBookings(): Promise<(Booking & { customer: Customer; unit: Unit })[]> {
  const db = readDb();
  const todayStr = today();
  
  return db.bookings
    .filter(b => {
      // Only active bookings with action dates that have passed
      if (!ACTIVE_STATUSES.includes(b.status)) return false;
      if (!b.actionDate) return false;
      return b.actionDate <= todayStr;
    })
    .map(b => {
      const customer = db.customers.find(c => c.id === b.customerId);
      const unit = db.units.find(u => u.id === b.unitId);
      return { ...b, customer: customer!, unit: unit! };
    })
    .filter(b => b.customer && b.unit)
    .sort((a, b) => (a.actionDate || '').localeCompare(b.actionDate || ''));
}

export async function getAvailableUnitsByType(
  startDate: string,
  endDate: string,
  unitType?: UnitType
): Promise<Unit[]> {
  const db = readDb();
  
  return db.units.filter((unit) => {
    // Filter by unit type if specified
    if (unitType && unit.unitType !== unitType) return false;
    return !unitConflict(db, unit.id, startDate, endDate);
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
  if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
    return { success: false, error: 'Collection date must be on or after the delivery date' };
  }
  const conflict = unitConflict(db, input.unitId, input.startDate, input.endDate);
  if (conflict) {
    return { success: false, error: conflict };
  }
  const unit = db.units.find((u) => u.id === input.unitId)!;

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
  ensureScheduledDocket(db, booking, 'DELIVERY');
  writeDb(db);
  revalidatePath('/', 'layout');

  return { success: true, booking };
}

export async function updateBooking(
  bookingId: string,
  input: UpdateBookingInput
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const db = readDb();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) return { success: false, error: 'Booking not found' };
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    return { success: false, error: 'Completed or cancelled bookings cannot be edited' };
  }
  const onHire = booking.status === 'ON_HIRE';
  if (onHire && ((input.unitId && input.unitId !== booking.unitId) || (input.startDate && input.startDate !== booking.startDate))) {
    return { success: false, error: 'The unit and delivery date cannot change once the unit is on hire' };
  }

  const next = { ...booking, ...input };
  if (next.endDate < next.startDate) {
    return { success: false, error: 'Collection date must be on or after the delivery date' };
  }
  const conflict = unitConflict(db, next.unitId, next.startDate, next.endDate, booking.id);
  if (conflict && !(onHire && conflict === 'Unit is under maintenance')) {
    return { success: false, error: conflict };
  }
  const unit = db.units.find((u) => u.id === next.unitId)!;
  if (next.powerAvailable === 'STANDARD' && unit.powerType === 'INDUSTRIAL') {
    return { success: false, error: 'Unit requires industrial power' };
  }

  Object.assign(booking, input);
  // Keep open jobs in step with the booking
  for (const d of db.dockets.filter((d) => d.bookingId === booking.id && d.status !== 'COMPLETED')) {
    d.unitId = booking.unitId;
    d.scheduledDate = d.type === 'DELIVERY' ? booking.startDate : booking.endDate;
    d.scheduledTime = d.type === 'DELIVERY' ? booking.deliveryTime : booking.collectionTime;
    if (booking.what3wordsAddress) d.what3wordsAddress = booking.what3wordsAddress;
    if (d.type === 'DELIVERY') d.checklist.tempSetting = booking.tempRequired;
  }
  writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true, booking };
}

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) return { success: false, error: 'Booking not found' };
  if (booking.status !== 'CONFIRMED') {
    return { success: false, error: 'Only bookings that have not been delivered can be cancelled' };
  }
  booking.status = 'CANCELLED';
  booking.cancelledAt = new Date().toISOString();
  booking.cancellationReason = reason?.trim() || undefined;
  booking.actionDate = undefined;
  // Drop the jobs that will no longer happen
  db.dockets = db.dockets.filter((d) => !(d.bookingId === booking.id && d.status !== 'COMPLETED'));
  writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
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
  return completeJob('DELIVERY', input);
}

export async function markCollected(
  input: MarkCollectedInput
): Promise<{ success: boolean; docket?: DeliveryDocket; error?: string }> {
  return completeJob('COLLECTION', input);
}

// ============ DELIVERY MANAGEMENT ============

export async function getAllDockets(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff })[]> {
  const db = readDbWithJobs();
  return db.dockets.map(d => {
    const booking = db.bookings.find(b => b.id === d.bookingId)!;
    const customer = db.customers.find(c => c.id === booking?.customerId)!;
    const unit = db.units.find(u => u.id === d.unitId)!;
    const staff = db.staff.find(s => s.id === d.staffId)!;
    return { ...d, booking, customer, unit, staff };
  }).filter(d => d.booking && d.customer && d.unit);
}

export async function getUpcomingDeliveries(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff })[]> {
  const db = readDbWithJobs();
  const todayStr = today();
  
  return db.dockets
    .filter(d => d.type === 'DELIVERY' && d.status === 'SCHEDULED' && d.scheduledDate >= todayStr)
    .map(d => {
      const booking = db.bookings.find(b => b.id === d.bookingId)!;
      const customer = db.customers.find(c => c.id === booking?.customerId)!;
      const unit = db.units.find(u => u.id === d.unitId)!;
      const staff = db.staff.find(s => s.id === d.staffId)!;
      return { ...d, booking, customer, unit, staff };
    })
    .filter(d => d.booking && d.customer && d.unit)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

export async function updateDocketChecklist(
  docketId: string,
  checklist: Partial<DeliveryChecklist>
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const docket = db.dockets.find(d => d.id === docketId);
  
  if (!docket) {
    return { success: false, error: 'Docket not found' };
  }
  
  docket.checklist = { ...docket.checklist, ...checklist };
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function completeDocket(
  docketId: string,
  signedBy: string,
  signatureData?: string,
  what3wordsAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const docket = db.dockets.find(d => d.id === docketId);
  
  if (!docket) {
    return { success: false, error: 'Docket not found' };
  }
  if (docket.status === 'COMPLETED') {
    return { success: false, error: 'This job has already been completed' };
  }
  
  docket.signedBy = signedBy;
  docket.signatureData = signatureData;
  docket.what3wordsAddress = what3wordsAddress || docket.what3wordsAddress;
  finaliseDocket(db, docket);
  
  writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Open (not yet completed) job for a booking, if one exists. */
export async function getOpenDocket(bookingId: string, type: DeliveryDocket['type']): Promise<DeliveryDocket | null> {
  const db = readDb();
  return db.dockets.find((d) => d.bookingId === bookingId && d.type === type && d.status !== 'COMPLETED') ?? null;
}

export async function getStaff(): Promise<Staff[]> {
  const db = readDb();
  return db.staff;
}

export async function getUpcomingCollections(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff; deliveryDocket?: DeliveryDocket })[]> {
  const db = readDbWithJobs();
  const todayStr = today();
  
  // Get collection dockets that are scheduled
  const collectionDockets = db.dockets
    .filter(d => d.type === 'COLLECTION' && d.status === 'SCHEDULED' && d.scheduledDate >= todayStr)
    .map(d => {
      const booking = db.bookings.find(b => b.id === d.bookingId)!;
      const customer = db.customers.find(c => c.id === booking?.customerId)!;
      const unit = db.units.find(u => u.id === d.unitId)!;
      const staff = db.staff.find(s => s.id === d.staffId)!;
      // Find the delivery docket for this booking to check what was delivered
      const deliveryDocket = db.dockets.find(dd => dd.bookingId === d.bookingId && dd.type === 'DELIVERY');
      return { ...d, booking, customer, unit, staff, deliveryDocket };
    })
    .filter(d => d.booking && d.customer && d.unit)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  
  return collectionDockets;
}

export async function getCollectionsFromBookings(): Promise<(Booking & { customer: Customer; unit: Unit; deliveryDocket?: DeliveryDocket })[]> {
  const db = readDb();
  const todayStr = today();
  
  // Get bookings that are ON_HIRE and due for collection (endDate <= today)
  return db.bookings
    .filter(b => b.status === 'ON_HIRE' && b.endDate <= todayStr)
    .map(b => {
      const customer = db.customers.find(c => c.id === b.customerId)!;
      const unit = db.units.find(u => u.id === b.unitId)!;
      const deliveryDocket = db.dockets.find(d => d.id === b.deliveryDocketId);
      return { ...b, customer, unit, deliveryDocket };
    })
    .filter(b => b.customer && b.unit)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

export async function getCompletedCollections(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit })[]> {
  const db = readDb();
  
  return db.dockets
    .filter(d => d.type === 'COLLECTION' && d.status === 'COMPLETED')
    .map(d => {
      const booking = db.bookings.find(b => b.id === d.bookingId)!;
      const customer = db.customers.find(c => c.id === booking?.customerId)!;
      const unit = db.units.find(u => u.id === d.unitId)!;
      return { ...d, booking, customer, unit };
    })
    .filter(d => d.booking && d.customer && d.unit)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
}

export async function createCollectionDocket(
  bookingId: string,
  staffId: string,
  scheduledDate: string,
  scheduledTime?: string
): Promise<{ success: boolean; docket?: DeliveryDocket; error?: string }> {
  const db = readDb();
  const booking = db.bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }
  
  if (booking.status !== 'ON_HIRE') {
    return { success: false, error: 'Booking is not on hire' };
  }
  
  // Get the delivery docket to copy accessory info
  const deliveryDocket = db.dockets.find(d => d.id === booking.deliveryDocketId);
  
  const docket: DeliveryDocket = {
    id: generateId('dock'),
    bookingId: booking.id,
    unitId: booking.unitId,
    type: 'COLLECTION',
    scheduledDate,
    scheduledTime,
    staffId,
    checklist: {
      unitClean: false,
      doorsSealed: false,
      tempVerified: false,
      powerConnected: false,
      tempSetting: 0,
      powerSupplyChecked: false,
      powerCableConnected: false,
      hitchLockSecured: deliveryDocket?.checklist.hitchLockSecured || false,
      wheelClampSecured: deliveryDocket?.checklist.wheelClampSecured || false,
      doorLockSecured: deliveryDocket?.checklist.doorLockSecured || false,
    },
    tempSet: 0,
    signedBy: '',
    photoUrls: [],
    status: 'SCHEDULED',
  };
  
  db.dockets.push(docket);
  writeDb(db);
  revalidatePath('/');
  
  return { success: true, docket };
}

// ============ UNIT MANAGEMENT ============

export async function getUnitById(unitId: string): Promise<Unit | null> {
  const db = readDb();
  return db.units.find(u => u.id === unitId) || null;
}

export async function getUnitBookingHistory(unitId: string): Promise<(Booking & { customer: Customer })[]> {
  const db = readDb();
  return db.bookings
    .filter(b => b.unitId === unitId)
    .map(b => {
      const customer = db.customers.find(c => c.id === b.customerId)!;
      return { ...b, customer };
    })
    .filter(b => b.customer)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function updateUnit(
  unitId: string,
  data: Partial<Omit<Unit, 'id'>>
): Promise<{ success: boolean; unit?: Unit; error?: string }> {
  const db = readDb();
  const index = db.units.findIndex(u => u.id === unitId);
  
  if (index === -1) {
    return { success: false, error: 'Unit not found' };
  }
  
  db.units[index] = { ...db.units[index], ...data };
  writeDb(db);
  revalidatePath('/');
  return { success: true, unit: db.units[index] };
}

export async function addUnit(data: {
  id: string;
  size: UnitSize;
  powerType: PowerType;
  unitType: UnitType;
  notes?: string;
  specifications?: UnitSpecifications;
}): Promise<{ success: boolean; unit?: Unit; error?: string }> {
  const db = readDb();
  
  // Check if ID already exists
  if (db.units.some(u => u.id === data.id)) {
    return { success: false, error: 'Unit ID already exists' };
  }
  
  const unit: Unit = {
    ...data,
    status: 'AVAILABLE',
    createdAt: today(),
  };
  
  db.units.push(unit);
  writeDb(db);
  revalidatePath('/');
  return { success: true, unit };
}

export async function updateUnitSpecifications(
  unitId: string,
  specifications: UnitSpecifications
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  unit.specifications = { ...unit.specifications, ...specifications };
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function addBOMComponent(
  unitId: string,
  component: Omit<BOMComponent, 'id'>
): Promise<{ success: boolean; component?: BOMComponent; error?: string }> {
  const db = readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  const newComponent: BOMComponent = {
    id: generateId('bom'),
    ...component,
  };
  
  if (!unit.bom) {
    unit.bom = [];
  }
  unit.bom.push(newComponent);
  writeDb(db);
  revalidatePath('/');
  return { success: true, component: newComponent };
}

export async function removeBOMComponent(
  unitId: string,
  componentId: string
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit || !unit.bom) {
    return { success: false, error: 'Unit or component not found' };
  }
  
  unit.bom = unit.bom.filter(c => c.id !== componentId);
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function addMaintenanceRecord(
  unitId: string,
  record: Omit<MaintenanceRecord, 'id'>
): Promise<{ success: boolean; record?: MaintenanceRecord; error?: string }> {
  const db = readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  const newRecord: MaintenanceRecord = {
    id: generateId('maint'),
    ...record,
  };
  
  if (!unit.maintenanceHistory) {
    unit.maintenanceHistory = [];
  }
  unit.maintenanceHistory.unshift(newRecord);
  writeDb(db);
  revalidatePath('/');
  return { success: true, record: newRecord };
}

export async function addUnitPhotos(
  unitId: string,
  formData: FormData
): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> {
  const db = readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return { success: false, error: 'Unit not found' };

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { success: false, error: 'Choose at least one photo' };
  for (const f of files) {
    if (!IMAGE_TYPES[f.type]) return { success: false, error: `${f.name} is not a JPG, PNG, WebP or GIF image` };
    if (f.size > MAX_UPLOAD_BYTES) return { success: false, error: `${f.name} is larger than 8 MB` };
  }

  const urls: string[] = [];
  for (const f of files) {
    urls.push(saveImage(['units', unit.id], Buffer.from(await f.arrayBuffer()), f.type));
  }
  unit.specifications = { ...unit.specifications, photoUrls: [...(unit.specifications?.photoUrls ?? []), ...urls] };
  writeDb(db);
  revalidatePath(`/units/${unit.id}`);
  return { success: true, photoUrls: unit.specifications.photoUrls };
}

export async function removeUnitPhoto(unitId: string, url: string): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit?.specifications?.photoUrls?.includes(url)) return { success: false, error: 'Photo not found' };
  unit.specifications.photoUrls = unit.specifications.photoUrls.filter((p) => p !== url);
  deleteImage(url);
  writeDb(db);
  revalidatePath(`/units/${unit.id}`);
  return { success: true };
}

const DEFAULT_SERVICEABLE_COMPONENTS: Omit<ServiceableComponent, 'id'>[] = [
  { type: 'COMPRESSOR', name: 'Compressor', description: 'Main refrigeration compressor unit', intervalMonths: 12 },
  { type: 'EVAPORATOR', name: 'Evaporator', description: 'Evaporator coils and housing', intervalMonths: 6 },
  { type: 'CONTROLLER', name: 'Temperature controller', description: 'Digital temperature control unit', intervalMonths: 12 },
  { type: 'FAN_MOTOR', name: 'Fan motor', description: 'Evaporator and condenser fan motors', intervalMonths: 6 },
  { type: 'OTHER', name: 'Door seals', description: 'Rubber door gaskets and seals', intervalMonths: 12 },
  { type: 'OTHER', name: 'Refrigerant', description: 'Refrigerant gas levels and pressure', intervalMonths: 12 },
  { type: 'OTHER', name: 'Electrical', description: 'Wiring, connections and safety switches', intervalMonths: 12 },
  { type: 'OTHER', name: 'Drainage', description: 'Condensate drain and tray', intervalMonths: 6 },
];

export async function getServiceableComponentList(): Promise<ServiceableComponent[]> {
  const db = readDb();
  return db.serviceableComponents ?? DEFAULT_SERVICEABLE_COMPONENTS.map((c, i) => ({ ...c, id: `svc-default-${i + 1}` }));
}

function validateComponent(data: Omit<ServiceableComponent, 'id'>): string | null {
  if (!data.name.trim()) return 'Enter a component name';
  if (!Number.isInteger(data.intervalMonths) || data.intervalMonths < 1 || data.intervalMonths > 120) {
    return 'Service interval must be between 1 and 120 months';
  }
  return null;
}

export async function saveServiceableComponent(
  data: Omit<ServiceableComponent, 'id'> & { id?: string }
): Promise<{ success: boolean; error?: string }> {
  const error = validateComponent(data);
  if (error) return { success: false, error };
  const db = readDb();
  // First edit materialises the default list so it becomes fully editable
  db.serviceableComponents ??= await getServiceableComponentList();
  const clean = { type: data.type, name: data.name.trim(), description: data.description?.trim() || undefined, intervalMonths: data.intervalMonths };
  const existing = data.id ? db.serviceableComponents.find((c) => c.id === data.id) : undefined;
  if (data.id && !existing) return { success: false, error: 'Component not found' };
  if (existing) Object.assign(existing, clean);
  else db.serviceableComponents.push({ id: generateId('svc'), ...clean });
  writeDb(db);
  revalidatePath('/maintenance');
  return { success: true };
}

export async function removeServiceableComponent(id: string): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  db.serviceableComponents ??= await getServiceableComponentList();
  const before = db.serviceableComponents.length;
  db.serviceableComponents = db.serviceableComponents.filter((c) => c.id !== id);
  if (db.serviceableComponents.length === before) return { success: false, error: 'Component not found' };
  writeDb(db);
  revalidatePath('/maintenance');
  return { success: true };
}

export async function setUnitStatus(
  unitId: string,
  status: UnitStatus
): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  unit.status = status;
  if (status !== 'ON_HIRE') {
    unit.currentBookingId = undefined;
  }
  writeDb(db);
  revalidatePath('/');
  return { success: true };
}

// ============ MAINTENANCE MANAGEMENT ============

export async function getAllMaintenanceRecords(): Promise<(MaintenanceRecord & { unit: Unit })[]> {
  const db = readDb();
  const records: (MaintenanceRecord & { unit: Unit })[] = [];
  
  db.units.forEach(unit => {
    if (unit.maintenanceHistory) {
      unit.maintenanceHistory.forEach(record => {
        records.push({ ...record, unit });
      });
    }
  });
  
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getMaintenanceDueNotifications(): Promise<{ unit: Unit; record: MaintenanceRecord; daysOverdue: number }[]> {
  const db = readDb();
  const todayStr = today();
  const notifications: { unit: Unit; record: MaintenanceRecord; daysOverdue: number }[] = [];
  
  db.units.forEach(unit => {
    if (unit.maintenanceHistory) {
      unit.maintenanceHistory.forEach(record => {
        if (record.nextServiceDate && record.nextServiceDate <= todayStr) {
          const nextDate = new Date(record.nextServiceDate);
          const todayDate = new Date(todayStr);
          const daysOverdue = Math.floor((todayDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
          notifications.push({ unit, record, daysOverdue });
        }
      });
    }
  });
  
  return notifications.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export async function getUnitsInMaintenance(): Promise<Unit[]> {
  const db = readDb();
  return db.units.filter(u => u.status === 'MAINTENANCE');
}

export async function getAllBOMComponents(): Promise<(BOMComponent & { unit: Unit })[]> {
  const db = readDb();
  const components: (BOMComponent & { unit: Unit })[] = [];
  
  db.units.forEach(unit => {
    if (unit.bom) {
      unit.bom.forEach(component => {
        components.push({ ...component, unit });
      });
    }
  });
  
  return components;
}

export async function getServiceableComponents(): Promise<{ type: BOMComponent['type']; count: number; units: string[] }[]> {
  const db = readDb();
  const componentMap = new Map<BOMComponent['type'], Set<string>>();
  
  db.units.forEach(unit => {
    if (unit.bom) {
      unit.bom.forEach(component => {
        if (!componentMap.has(component.type)) {
          componentMap.set(component.type, new Set());
        }
        componentMap.get(component.type)!.add(unit.id);
      });
    }
  });
  
  return Array.from(componentMap.entries()).map(([type, unitSet]) => ({
    type,
    count: unitSet.size,
    units: Array.from(unitSet),
  }));
}

export async function getAllUnits(): Promise<Unit[]> {
  const db = readDb();
  return db.units;
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

// ============ UI VIEW MODELS ============

function withDetails(db: ReturnType<typeof readDb>, b: Booking): BookingWithDetails | null {
  const customer = db.customers.find((c) => c.id === b.customerId);
  const unit = db.units.find((u) => u.id === b.unitId);
  return customer && unit ? { ...b, customer, unit } : null;
}

export async function getShellData(): Promise<ShellData> {
  const db = readDb();
  const todayStr = today();
  const notifications: AppNotification[] = [];

  for (const b of db.bookings) {
    const customer = db.customers.find((c) => c.id === b.customerId);
    if (ACTIVE_STATUSES.includes(b.status) && b.actionDate && b.actionDate <= todayStr) {
      notifications.push({
        id: `action-${b.id}`,
        kind: 'ACTION_OVERDUE',
        title: b.actionDescription || 'Follow-up required',
        description: `${customer?.name ?? 'Unknown customer'} · ${b.unitId}`,
        date: b.actionDate,
        href: `/bookings/${b.id}`,
      });
    }
    if (b.status === 'ON_HIRE' && b.endDate < todayStr) {
      notifications.push({
        id: `collect-${b.id}`,
        kind: 'COLLECTION_OVERDUE',
        title: `Collection overdue · ${b.unitId}`,
        description: customer?.name ?? 'Unknown customer',
        date: b.endDate,
        href: `/bookings/${b.id}`,
      });
    }
  }
  for (const u of db.units) {
    const due = (u.maintenanceHistory ?? [])
      .map((r) => r.nextServiceDate)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1);
    if (due && due <= todayStr) {
      notifications.push({
        id: `service-${u.id}`,
        kind: 'SERVICE_DUE',
        title: `Service due · ${u.id}`,
        description: 'Scheduled maintenance has passed its due date',
        date: due,
        href: `/units/${u.id}`,
      });
    }
  }
  notifications.sort((a, b) => a.date.localeCompare(b.date));

  const customerName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? '';

  return {
    counts: {
      deliveriesToday: db.bookings.filter((b) => b.status === 'CONFIRMED' && b.startDate === todayStr).length,
      collectionsDue: db.bookings.filter((b) => b.status === 'ON_HIRE' && b.endDate <= todayStr).length,
      actionsOverdue: notifications.filter((n) => n.kind === 'ACTION_OVERDUE').length,
      serviceDue: notifications.filter((n) => n.kind === 'SERVICE_DUE').length,
    },
    notifications,
    searchIndex: [
      ...db.customers.map((c) => ({
        type: 'customer' as const,
        id: c.id,
        label: c.name,
        sublabel: c.email || c.phone,
        href: `/customers/${c.id}`,
      })),
      ...db.units.map((u) => ({
        type: 'unit' as const,
        id: u.id,
        label: u.id,
        sublabel: `${u.unitType.replace('_', ' ').toLowerCase()} · ${u.status.replace('_', ' ').toLowerCase()}`,
        href: `/units/${u.id}`,
      })),
      ...db.bookings
        .filter((b) => ACTIVE_STATUSES.includes(b.status))
        .map((b) => ({
          type: 'booking' as const,
          id: b.id,
          label: b.id,
          sublabel: `${customerName(b.customerId)} · ${b.unitId}`,
          href: `/bookings/${b.id}`,
        })),
    ],
  };
}

export async function getDashboardData() {
  const db = readDb();
  const todayStr = today();
  const tomorrowStr = tomorrow();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().split('T')[0];

  const details = (list: Booking[]) =>
    list.map((b) => withDetails(db, b)).filter((b): b is BookingWithDetails => !!b);

  return {
    units: db.units,
    deliveries: details(
      db.bookings.filter((b) => b.status === 'CONFIRMED' && (b.startDate === todayStr || b.startDate === tomorrowStr))
    ),
    collections: details(db.bookings.filter((b) => b.status === 'ON_HIRE' && b.endDate <= tomorrowStr)),
    upcoming: details(
      db.bookings
        .filter((b) => b.status === 'CONFIRMED' && b.startDate > tomorrowStr && b.startDate <= in7Str)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    ),
    today: todayStr,
    tomorrow: tomorrowStr,
  };
}

export async function getBookingDetail(id: string) {
  const db = readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return null;
  const detailed = withDetails(db, booking);
  if (!detailed) return null;
  const dockets = db.dockets.filter((d) => d.bookingId === id);
  const staffName = (sid: string) => db.staff.find((s) => s.id === sid)?.name;
  const pick = (type: DeliveryDocket['type']) =>
    dockets.find((d) => d.type === type && d.status === 'COMPLETED') ?? dockets.find((d) => d.type === type);
  return {
    booking: detailed,
    delivery: pick('DELIVERY'),
    collection: pick('COLLECTION'),
    staff: Object.fromEntries(dockets.map((d) => [d.staffId, staffName(d.staffId) ?? 'Unassigned'])),
    allStaff: db.staff,
    units: db.units,
  };
}

export async function getCustomerDetail(id: string) {
  const db = readDb();
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) return null;
  const bookings = db.bookings
    .filter((b) => b.customerId === id)
    .map((b) => ({ ...b, unit: db.units.find((u) => u.id === b.unitId)! }))
    .filter((b) => b.unit)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const preferredUnit = customer.preferences?.preferredUnitId
    ? db.units.find((u) => u.id === customer.preferences?.preferredUnitId) ?? null
    : null;
  return { customer, bookings, preferredUnit, units: db.units };
}

export async function getUnitDetail(id: string) {
  const db = readDb();
  const unit = db.units.find((u) => u.id === id);
  if (!unit) return null;
  const bookingHistory = db.bookings
    .filter((b) => b.unitId === id)
    .map((b) => ({ ...b, customer: db.customers.find((c) => c.id === b.customerId)! }))
    .filter((b) => b.customer)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const currentBooking = bookingHistory.find((b) => b.status === 'ON_HIRE') ?? null;
  return { unit, bookingHistory, currentBooking };
}

export async function getCustomersWithStats(): Promise<CustomerWithStats[]> {
  const db = readDb();
  return db.customers
    .map((c) => {
      const bookings = db.bookings.filter((b) => b.customerId === c.id);
      return {
        ...c,
        activeHires: bookings.filter((b) => b.status === 'ON_HIRE').length,
        totalBookings: bookings.length,
        lastBookingDate: bookings.map((b) => b.startDate).sort().at(-1),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUnitsWithHire(): Promise<UnitWithHire[]> {
  const db = readDb();
  const todayStr = today();
  const name = (id: string) => db.customers.find((c) => c.id === id)?.name ?? 'Unknown';
  return db.units
    .map((u) => {
      const hire = db.bookings.find((b) => b.unitId === u.id && b.status === 'ON_HIRE');
      const next = db.bookings
        .filter((b) => b.unitId === u.id && b.status === 'CONFIRMED' && b.startDate >= todayStr)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      return {
        ...u,
        currentHire: hire && {
          bookingId: hire.id,
          customerId: hire.customerId,
          customerName: name(hire.customerId),
          startDate: hire.startDate,
          endDate: hire.endDate,
        },
        nextBooking: next && { bookingId: next.id, customerName: name(next.customerId), startDate: next.startDate },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
