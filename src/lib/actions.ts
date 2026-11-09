'use server';

import { revalidatePath } from 'next/cache';
import { readDb, writeDb } from './db';
import { saveImage, saveFile, deleteImage, IMAGE_TYPES, MAX_UPLOAD_BYTES, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from './uploads';
import { formatAddress } from './format';
import { nextServiceDate, COMPONENT_LABELS } from './domain';
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
  BookingStatus,
  Staff,
  AppNotification,
  BookingWithDetails,
  CustomerWithStats,
  ShellData,
  UnitWithHire,
  UpdateBookingGroupInput,
  BookingSharedInput,
  BookingLineInput,
  ServiceableComponent,
  Database,
} from '@/types';

// Helper to generate IDs
function generateId(prefix: string): string {
  // Random suffix: several records (e.g. unit lines and their jobs) are created in the same millisecond
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

type Db = Database;

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
  if (unit.breakdown) return 'Unit is marked as broken down';
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
    checklist.tempRecorderFitted = delivery.checklist.tempRecorderFitted;
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

async function readDbWithJobs(): Promise<Db> {
  const db = await readDb();
  if (backfillOpenJobs(db)) await writeDb(db);
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

/** Completes one unit's job in memory; returns an error message or the completed docket. */
function applyJob(db: Db, type: DeliveryDocket['type'], input: MarkDeliveredInput): string | DeliveryDocket {
  const booking = db.bookings.find((b) => b.id === input.bookingId);
  if (!booking) return 'Booking not found';
  const expected: BookingStatus = type === 'DELIVERY' ? 'CONFIRMED' : 'ON_HIRE';
  if (booking.status !== expected) {
    return `${booking.unitId}: ${type === 'DELIVERY' ? 'not awaiting delivery' : 'not on hire'}`;
  }
  if (!db.units.some((u) => u.id === booking.unitId)) return 'Unit not found';
  if (!input.signedBy.trim()) return 'Customer sign-off is required';

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
  return docket;
}

async function completeJob(type: DeliveryDocket['type'], input: MarkDeliveredInput): Promise<{ success: boolean; docket?: DeliveryDocket; error?: string }> {
  const db = await readDb();
  const result = applyJob(db, type, input);
  if (typeof result === 'string') return { success: false, error: result };
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true, docket: result };
}

/** Confirm a delivery or collection for several units of a booking at once (one signature). */
export async function completeJobs(
  type: DeliveryDocket['type'],
  inputs: MarkDeliveredInput[]
): Promise<{ success: boolean; error?: string }> {
  if (inputs.length === 0) return { success: false, error: 'Choose at least one unit' };
  const db = await readDb();
  for (const input of inputs) {
    const result = applyJob(db, type, input);
    if (typeof result === 'string') return { success: false, error: result };
  }
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Forms send '' (or null) for a field the user emptied: `undefined` is dropped when a server
 * action's arguments are sent, so it would leave the old value in place. Remove those keys.
 */
function withoutCleared<T extends object>(obj: T): T {
  for (const [k, v] of Object.entries(obj)) if (v === '' || v === null || v === undefined) delete (obj as Record<string, unknown>)[k];
  return obj;
}

// ============ CUSTOMER ACTIONS ============

/** The one-line address is derived from the structured invoice address whenever one is given. */
function withFormattedAddress<T extends Partial<Pick<Customer, 'address' | 'invoiceAddress'>>>(data: T): T {
  return data.invoiceAddress ? { ...data, address: formatAddress(data.invoiceAddress) } : data;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const db = await readDb();
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
  const db = await readDb();
  return db.bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function addCustomer(
  data: Omit<Customer, 'id' | 'createdAt'>
): Promise<Customer> {
  const db = await readDb();
  const customer: Customer = {
    id: generateId('cust'),
    ...withoutCleared(withFormattedAddress({ ...data })),
    createdAt: today(),
  };
  db.customers.push(customer);
  await writeDb(db);
  revalidatePath('/');
  return customer;
}

export async function addCustomerAddress(
  customerId: string,
  data: Omit<CustomerAddress, 'id'>
): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
  const db = await readDb();
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
  await writeDb(db);
  revalidatePath('/');
  return { success: true, address };
}

export async function getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const db = await readDb();
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
  const db = await readDb();
  return db.customers.find(c => c.id === customerId) || null;
}

export async function getCustomerBookings(customerId: string): Promise<(Booking & { unit: Unit })[]> {
  const db = await readDb();
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
  const db = await readDb();
  const index = db.customers.findIndex(c => c.id === customerId);
  
  if (index === -1) {
    return { success: false, error: 'Customer not found' };
  }
  
  db.customers[index] = withoutCleared({
    ...db.customers[index],
    ...withFormattedAddress(data),
  });
  
  await writeDb(db);
  revalidatePath('/');
  return { success: true, customer: db.customers[index] };
}

export async function updateCustomerPreferences(
  customerId: string,
  preferences: CustomerPreferences
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const customer = db.customers.find(c => c.id === customerId);
  
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  
  // The form sends the complete set, so replace rather than merge (merging could never clear a field)
  customer.preferences = withoutCleared({ ...preferences });
  await writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const customer = db.customers.find(c => c.id === customerId);
  
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  
  if (!customer.addresses) {
    return { success: false, error: 'Address not found' };
  }
  
  customer.addresses = customer.addresses.filter(a => a.id !== addressId);
  await writeDb(db);
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
  const db = await readDb();

  return db.units.filter((unit) => {
    // Units on hire are only unavailable for dates that overlap their current hire
    if (unitConflict(db, unit.id, startDate, endDate, ignoreBookingId)) return false;

    // Apply spec filters
    if (spec?.size && unit.size !== spec.size) return false;

    return true;
  });
}

export async function getMatchingUnits(spec: UnitSpec): Promise<Unit[]> {
  const db = await readDb();
  return db.units.filter((unit) => {
    if (unit.status !== 'AVAILABLE' || unit.breakdown) return false;
    if (spec.size && unit.size !== spec.size) return false;
    return true;
  });
}

export async function getUnitsByType(unitType?: UnitType): Promise<Unit[]> {
  const db = await readDb();
  if (!unitType) return db.units;
  return db.units.filter(u => u.unitType === unitType);
}

export async function getOverdueActionBookings(): Promise<(Booking & { customer: Customer; unit: Unit })[]> {
  const db = await readDb();
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
  const db = await readDb();
  
  return db.units.filter((unit) => {
    // Filter by unit type if specified
    if (unitType && unit.unitType !== unitType) return false;
    return !unitConflict(db, unit.id, startDate, endDate);
  });
}

export async function getPreviousUnit(customerId: string): Promise<Unit | null> {
  const db = await readDb();
  const customerBookings = db.bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (customerBookings.length === 0) return null;

  const lastUnitId = customerBookings[0].unitId;
  return db.units.find((u) => u.id === lastUnitId) || null;
}

// ============ BOOKING ACTIONS ============

/** Fields kept identical across every unit line of a booking. */
const SHARED_KEYS = [
  'contactName',
  'contactPhone',
  'deliveryAddress',
  'deliveryAddressId',
  'what3wordsAddress',
  'accessInstructions',
  'powerAvailable',
  'powerOther',
  'application',
  'notes',
  'actionDate',
  'actionDescription',
  'quote',
] as const satisfies readonly (keyof BookingSharedInput)[];

const groupIdOf = (b: Booking) => b.groupId ?? b.id;

/** All unit lines of the booking that `bookingId` belongs to, first line first. */
function groupLines(db: Db, bookingId: string): Booking[] {
  const booking = db.bookings.find((b) => b.id === bookingId || b.groupId === bookingId);
  if (!booking) return [];
  const gid = groupIdOf(booking);
  return db.bookings.filter((b) => groupIdOf(b) === gid);
}

function cleanShared(shared: Omit<BookingSharedInput, 'customerId'>) {
  const s = Object.fromEntries(SHARED_KEYS.map((k) => [k, shared[k]])) as Omit<BookingSharedInput, 'customerId'>;
  s.powerOther = s.powerAvailable === 'OTHER' ? s.powerOther?.trim() || undefined : undefined;
  return s;
}

function validateShared(shared: Omit<BookingSharedInput, 'customerId'>): string | null {
  if (!shared.contactName?.trim() || !shared.contactPhone?.trim()) return 'Enter the site contact name and phone number';
  if (!shared.deliveryAddress?.trim()) return 'Enter the delivery address';
  if (shared.powerAvailable === 'OTHER' && !shared.powerOther?.trim()) return 'Describe the site power supply';
  return null;
}

/** Checks each line's dates and unit against the fleet and against the other lines of the same booking. */
function validateLines(db: Db, lines: (BookingLineInput & { id?: string })[], allowOnHireIds: Set<string> = new Set()): string | null {
  if (lines.length === 0) return 'Add at least one unit';
  for (const [i, l] of lines.entries()) {
    if (!l.startDate || !l.endDate || l.endDate < l.startDate) return `${l.unitId || 'Unit'}: collection date must be on or after the delivery date`;
    const conflict = unitConflict(db, l.unitId, l.startDate, l.endDate, l.id);
    // Units already on hire can still have their hire extended while in maintenance or broken down
    if (conflict && !(l.id && allowOnHireIds.has(l.id) && conflict !== 'Unit has a conflicting booking for these dates')) return `${l.unitId}: ${conflict}`;
    const clash = lines.some((o, j) => j !== i && o.unitId === l.unitId && datesOverlap(l.startDate, l.endDate, o.startDate, o.endDate));
    if (clash) return `${l.unitId} is on this booking twice for overlapping dates`;
  }
  return null;
}

function lineFields(l: BookingLineInput): BookingLineInput {
  return {
    unitId: l.unitId,
    startDate: l.startDate,
    endDate: l.endDate,
    deliveryTime: l.deliveryTime || undefined,
    collectionTime: l.collectionTime || undefined,
    tempRequired: l.tempRequired,
    cableLength: l.cableLength,
    accessories: l.accessories,
    rate: l.rate !== undefined && l.rate >= 0 ? l.rate : undefined,
    ratePeriod: l.rate !== undefined ? l.ratePeriod ?? 'DAY' : undefined,
  };
}

/** Keep a line's open jobs in step with its dates, unit and site. */
function syncOpenJobs(db: Db, booking: Booking) {
  for (const d of db.dockets.filter((d) => d.bookingId === booking.id && d.status !== 'COMPLETED')) {
    d.unitId = booking.unitId;
    d.scheduledDate = d.type === 'DELIVERY' ? booking.startDate : booking.endDate;
    d.scheduledTime = d.type === 'DELIVERY' ? booking.deliveryTime : booking.collectionTime;
    if (booking.what3wordsAddress) d.what3wordsAddress = booking.what3wordsAddress;
    if (d.type === 'DELIVERY') {
      d.checklist.tempSetting = booking.tempRequired;
      d.tempSet = booking.tempRequired;
    }
  }
}

export async function createBooking(
  input: CreateBookingInput
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const db = await readDb();
  if (!db.customers.some((c) => c.id === input.customerId)) return { success: false, error: 'Customer not found' };
  const shared = cleanShared(input);
  const error = validateShared(shared) ?? validateLines(db, input.lines);
  if (error) return { success: false, error };

  const created: Booking[] = [];
  for (const line of input.lines) {
    const booking: Booking = {
      ...shared,
      ...lineFields(line),
      id: generateId('book'),
      customerId: input.customerId,
      status: 'CONFIRMED',
      createdAt: today(),
    };
    booking.groupId = created[0]?.id ?? booking.id;
    created.push(booking);
    db.bookings.push(booking);
    ensureScheduledDocket(db, booking, 'DELIVERY');
  }
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true, booking: created[0] };
}

/**
 * Save a booking: shared fields go to every unit line; listed lines are updated or added.
 * Lines that are on hire keep their unit and delivery date.
 */
export async function updateBookingGroup(
  bookingId: string,
  input: UpdateBookingGroupInput
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const lines = groupLines(db, bookingId);
  if (lines.length === 0) return { success: false, error: 'Booking not found' };
  if (!lines.some((l) => ACTIVE_STATUSES.includes(l.status))) {
    return { success: false, error: 'Completed or cancelled bookings cannot be edited' };
  }
  const shared = cleanShared(input.shared);
  const sharedError = validateShared(shared);
  if (sharedError) return { success: false, error: sharedError };

  const byId = new Map(lines.map((l) => [l.id, l]));
  const cancelIds = new Set(input.cancelIds ?? []);
  for (const id of cancelIds) {
    if (byId.get(id)?.status !== 'CONFIRMED') return { success: false, error: 'Only units that have not been delivered can be removed' };
  }
  if (input.lines.some((l) => l.id && cancelIds.has(l.id))) return { success: false, error: 'A removed unit is still listed' };
  if (input.lines.length === 0) return { success: false, error: 'A booking needs at least one unit. Cancel the booking instead.' };
  const onHire = new Set(lines.filter((l) => l.status === 'ON_HIRE').map((l) => l.id));
  for (const l of input.lines) {
    if (!l.id) continue;
    const existing = byId.get(l.id);
    if (!existing) return { success: false, error: 'Unit line not found on this booking' };
    if (!ACTIVE_STATUSES.includes(existing.status)) return { success: false, error: `${existing.unitId} is already ${existing.status === 'CANCELLED' ? 'cancelled' : 'collected'}` };
    if (onHire.has(l.id) && (l.unitId !== existing.unitId || l.startDate !== existing.startDate)) {
      return { success: false, error: `${existing.unitId} is on hire, so its unit and delivery date can't change` };
    }
  }
  const lineError = validateLines(db, input.lines, onHire);
  if (lineError) return { success: false, error: lineError };

  const first = lines[0];
  for (const l of lines) Object.assign(l, shared);
  const now = new Date().toISOString();
  for (const id of cancelIds) {
    Object.assign(byId.get(id)!, { status: 'CANCELLED', cancelledAt: now, cancellationReason: 'Removed from booking', actionDate: undefined });
  }
  db.dockets = db.dockets.filter((d) => !(cancelIds.has(d.bookingId) && d.status !== 'COMPLETED'));
  for (const l of input.lines) {
    if (l.id) {
      const booking = byId.get(l.id)!;
      Object.assign(booking, lineFields(l));
      syncOpenJobs(db, booking);
    } else {
      const booking: Booking = {
        ...shared,
        ...lineFields(l),
        id: generateId('book'),
        groupId: groupIdOf(first),
        customerId: first.customerId,
        status: 'CONFIRMED',
        createdAt: today(),
      };
      db.bookings.push(booking);
      ensureScheduledDocket(db, booking, 'DELIVERY');
    }
  }
  // First line of an old single-unit booking becomes the group reference once a unit is added
  first.groupId ??= first.id;
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Cancel one unit line, or every not-yet-delivered line of the booking when `wholeBooking` is set. */
export async function cancelBooking(
  bookingId: string,
  reason?: string,
  wholeBooking = true
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const targets = (wholeBooking ? groupLines(db, bookingId) : db.bookings.filter((b) => b.id === bookingId)).filter((b) => b.status === 'CONFIRMED');
  if (targets.length === 0) return { success: false, error: 'Only units that have not been delivered can be cancelled' };
  const now = new Date().toISOString();
  for (const booking of targets) {
    booking.status = 'CANCELLED';
    booking.cancelledAt = now;
    booking.cancellationReason = reason?.trim() || undefined;
    booking.actionDate = undefined;
  }
  // Drop the jobs that will no longer happen
  const ids = new Set(targets.map((b) => b.id));
  db.dockets = db.dockets.filter((d) => !(ids.has(d.bookingId) && d.status !== 'COMPLETED'));
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Per-line availability problems for the booking form (null = OK). */
export async function checkBookingLines(lines: (BookingLineInput & { id?: string })[]): Promise<(string | null)[]> {
  const db = await readDb();
  return lines.map((l, i) => {
    if (!l.unitId || !l.startDate || !l.endDate) return null;
    if (l.endDate < l.startDate) return 'Collection is before delivery';
    const conflict = unitConflict(db, l.unitId, l.startDate, l.endDate, l.id);
    const existing = l.id ? db.bookings.find((b) => b.id === l.id) : undefined;
    if (conflict && !(existing?.status === 'ON_HIRE' && conflict !== 'Unit has a conflicting booking for these dates')) return conflict;
    const clash = lines.some((o, j) => j !== i && o.unitId === l.unitId && datesOverlap(l.startDate, l.endDate, o.startDate, o.endDate));
    return clash ? 'Already on this booking for these dates' : null;
  });
}

// ============ DELIVERY ACTIONS ============

export async function getTomorrowsDeliveries(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDbWithJobs();
  return db.dockets.map(d => {
    const booking = db.bookings.find(b => b.id === d.bookingId)!;
    const customer = db.customers.find(c => c.id === booking?.customerId)!;
    const unit = db.units.find(u => u.id === d.unitId)!;
    const staff = db.staff.find(s => s.id === d.staffId)!;
    return { ...d, booking, customer, unit, staff };
  }).filter(d => d.booking && d.customer && d.unit);
}

export async function getUpcomingDeliveries(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff })[]> {
  const db = await readDbWithJobs();
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
  const db = await readDb();
  const docket = db.dockets.find(d => d.id === docketId);
  
  if (!docket) {
    return { success: false, error: 'Docket not found' };
  }
  
  docket.checklist = { ...docket.checklist, ...checklist };
  await writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function completeDocket(
  docketId: string,
  signedBy: string,
  signatureData?: string,
  what3wordsAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
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
  
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Open (not yet completed) job for a booking, if one exists. */
export async function getOpenDocket(bookingId: string, type: DeliveryDocket['type']): Promise<DeliveryDocket | null> {
  const db = await readDb();
  return db.dockets.find((d) => d.bookingId === bookingId && d.type === type && d.status !== 'COMPLETED') ?? null;
}

export async function getStaff(): Promise<Staff[]> {
  const db = await readDb();
  return db.staff;
}

export async function getUpcomingCollections(): Promise<(DeliveryDocket & { booking: Booking; customer: Customer; unit: Unit; staff: Staff; deliveryDocket?: DeliveryDocket })[]> {
  const db = await readDbWithJobs();
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
  const db = await readDb();
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
  const db = await readDb();
  
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
  const db = await readDb();
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
  await writeDb(db);
  revalidatePath('/');
  
  return { success: true, docket };
}

// ============ UNIT MANAGEMENT ============

export async function getUnitById(unitId: string): Promise<Unit | null> {
  const db = await readDb();
  return db.units.find(u => u.id === unitId) || null;
}

export async function getUnitBookingHistory(unitId: string): Promise<(Booking & { customer: Customer })[]> {
  const db = await readDb();
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
  const db = await readDb();
  const index = db.units.findIndex(u => u.id === unitId);
  
  if (index === -1) {
    return { success: false, error: 'Unit not found' };
  }
  
  db.units[index] = withoutCleared({ ...db.units[index], ...data });
  await writeDb(db);
  revalidatePath('/');
  return { success: true, unit: db.units[index] };
}

export async function addUnit(data: {
  id: string;
  size: UnitSize;
  unitType: UnitType;
  notes?: string;
  specifications?: UnitSpecifications;
}): Promise<{ success: boolean; unit?: Unit; error?: string }> {
  const db = await readDb();
  if (!data.id.trim()) return { success: false, error: 'Enter a unit ID' };
  
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
  await writeDb(db);
  revalidatePath('/');
  return { success: true, unit };
}

export async function updateUnitSpecifications(
  unitId: string,
  specifications: UnitSpecifications
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  // Full set from the form replaces the old one; photos are managed separately and kept
  unit.specifications = withoutCleared({ ...specifications, photoUrls: unit.specifications?.photoUrls });
  await writeDb(db);
  revalidatePath('/');
  return { success: true };
}

export async function addBOMComponent(
  unitId: string,
  component: Omit<BOMComponent, 'id'>
): Promise<{ success: boolean; component?: BOMComponent; error?: string }> {
  const db = await readDb();
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
  await writeDb(db);
  revalidatePath('/');
  return { success: true, component: newComponent };
}

export async function removeBOMComponent(
  unitId: string,
  componentId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit || !unit.bom) {
    return { success: false, error: 'Unit or component not found' };
  }
  
  unit.bom = unit.bom.filter(c => c.id !== componentId);
  await writeDb(db);
  revalidatePath('/');
  return { success: true };
}

/**
 * Create (no id) or update a service record. `files` may carry PDFs/images under "files",
 * which are added to the record's attachments.
 */
export async function saveMaintenanceRecord(
  unitId: string,
  record: Omit<MaintenanceRecord, 'id' | 'attachments'> & { id?: string },
  files?: FormData
): Promise<{ success: boolean; record?: MaintenanceRecord; error?: string }> {
  if (!record.description?.trim()) return { success: false, error: 'Describe the work carried out' };
  if (record.hoursWorked !== undefined && !(record.hoursWorked >= 0 && record.hoursWorked <= 1000)) {
    return { success: false, error: 'Hours worked must be between 0 and 1000' };
  }
  const uploads = (files?.getAll('files') ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of uploads) {
    if (!DOCUMENT_TYPES[f.type]) return { success: false, error: `${f.name} is not a PDF or image` };
    if (f.size > MAX_DOCUMENT_BYTES) return { success: false, error: `${f.name} is larger than 10 MB` };
  }

  const db = await readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return { success: false, error: 'Unit not found' };
  unit.maintenanceHistory ??= [];
  const existing = record.id ? unit.maintenanceHistory.find((r) => r.id === record.id) : undefined;
  if (record.id && !existing) return { success: false, error: 'Service record not found' };

  const attachments = [...(existing?.attachments ?? [])];
  for (const f of uploads) {
    const url = await saveFile(['maintenance', unit.id], Buffer.from(await f.arrayBuffer()), f.type);
    attachments.push({ name: f.name, url, size: f.size, type: f.type });
  }
  const clean: MaintenanceRecord = {
    id: existing?.id ?? generateId('maint'),
    date: record.date,
    type: record.type,
    description: record.description.trim(),
    performedBy: record.performedBy?.trim() ?? '',
    orderNumbers: [...new Set((record.orderNumbers ?? []).map((o) => o.trim()).filter(Boolean))],
    hoursWorked: record.hoursWorked,
    partsReplaced: record.partsReplaced?.map((p) => p.trim()).filter(Boolean),
    nextServiceDate: record.nextServiceDate || undefined,
    cost: existing?.cost,
    attachments,
  };
  if (existing) Object.assign(existing, clean);
  else unit.maintenanceHistory.unshift(clean);
  // A service that sets its own next date replaces any manually scheduled one
  if (clean.nextServiceDate) unit.nextServiceDate = undefined;
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true, record: clean };
}

export async function removeMaintenanceAttachment(unitId: string, recordId: string, url: string): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const record = db.units.find((u) => u.id === unitId)?.maintenanceHistory?.find((r) => r.id === recordId);
  if (!record?.attachments?.some((a) => a.url === url)) return { success: false, error: 'File not found' };
  record.attachments = record.attachments.filter((a) => a.url !== url);
  await deleteImage(url);
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function addUnitPhotos(
  unitId: string,
  formData: FormData
): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> {
  const db = await readDb();
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
    urls.push(await saveImage(['units', unit.id], Buffer.from(await f.arrayBuffer()), f.type));
  }
  unit.specifications = { ...unit.specifications, photoUrls: [...(unit.specifications?.photoUrls ?? []), ...urls] };
  await writeDb(db);
  revalidatePath(`/units/${unit.id}`);
  return { success: true, photoUrls: unit.specifications.photoUrls };
}

export async function removeUnitPhoto(unitId: string, url: string): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit?.specifications?.photoUrls?.includes(url)) return { success: false, error: 'Photo not found' };
  unit.specifications.photoUrls = unit.specifications.photoUrls.filter((p) => p !== url);
  await deleteImage(url);
  await writeDb(db);
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
  const db = await readDb();
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
  const db = await readDb();
  // First edit materialises the default list so it becomes fully editable
  db.serviceableComponents ??= await getServiceableComponentList();
  const clean = { type: data.type, name: data.name.trim(), description: data.description?.trim() || undefined, intervalMonths: data.intervalMonths };
  const existing = data.id ? db.serviceableComponents.find((c) => c.id === data.id) : undefined;
  if (data.id && !existing) return { success: false, error: 'Component not found' };
  if (existing) Object.assign(existing, clean);
  else db.serviceableComponents.push({ id: generateId('svc'), ...clean });
  await writeDb(db);
  revalidatePath('/maintenance');
  return { success: true };
}

export async function removeServiceableComponent(id: string): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  db.serviceableComponents ??= await getServiceableComponentList();
  const before = db.serviceableComponents.length;
  db.serviceableComponents = db.serviceableComponents.filter((c) => c.id !== id);
  if (db.serviceableComponents.length === before) return { success: false, error: 'Component not found' };
  await writeDb(db);
  revalidatePath('/maintenance');
  return { success: true };
}

export async function setUnitStatus(
  unitId: string,
  status: UnitStatus
): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find(u => u.id === unitId);
  
  if (!unit) {
    return { success: false, error: 'Unit not found' };
  }
  
  unit.status = status;
  if (status !== 'ON_HIRE') {
    unit.currentBookingId = undefined;
  }
  await writeDb(db);
  revalidatePath('/');
  return { success: true };
}

/** Flag a unit as broken down (notes given) or clear the flag (null). Works while on hire. */
export async function setUnitBreakdown(unitId: string, notes: string | null): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return { success: false, error: 'Unit not found' };
  unit.breakdown = notes === null ? undefined : { reportedAt: new Date().toISOString(), notes: notes.trim() || undefined };
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Schedule (or clear) the unit's next service date. */
export async function setUnitNextService(unitId: string, date: string | null): Promise<{ success: boolean; error?: string }> {
  const db = await readDb();
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return { success: false, error: 'Unit not found' };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Enter a valid date' };
  unit.nextServiceDate = date || undefined;
  await writeDb(db);
  revalidatePath('/', 'layout');
  return { success: true };
}

// ============ MAINTENANCE MANAGEMENT ============

export async function getAllMaintenanceRecords(): Promise<(MaintenanceRecord & { unit: Unit })[]> {
  const db = await readDb();
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

/** Units whose next service date (manual or from the last record) is today or earlier. */
export async function getMaintenanceDueNotifications(): Promise<{ unit: Unit; dueDate: string; lastRecord?: MaintenanceRecord; daysOverdue: number }[]> {
  const db = await readDb();
  const todayMs = Date.parse(today());
  return db.units
    .map((unit) => ({ unit, dueDate: nextServiceDate(unit), lastRecord: unit.maintenanceHistory?.[0] }))
    .filter((x): x is { unit: Unit; dueDate: string; lastRecord: MaintenanceRecord | undefined } => !!x.dueDate && x.dueDate <= today())
    .map((x) => ({ ...x, daysOverdue: Math.round((todayMs - Date.parse(x.dueDate)) / 86_400_000) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Units out of action: in maintenance or flagged as broken down. */
export async function getUnitsInMaintenance(): Promise<Unit[]> {
  const db = await readDb();
  return db.units.filter((u) => u.status === 'MAINTENANCE' || u.breakdown);
}

export async function getAllBOMComponents(): Promise<(BOMComponent & { unit: Unit })[]> {
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDb();
  return db.units;
}

// ============ DATA SELECTORS ============

export async function bookingsForCalendar(): Promise<
  Array<Booking & { customer: Customer; unit: Unit }>
> {
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDb();
  if (!status) return db.units;
  return db.units.filter((u) => u.status === status);
}

export async function getAllStaff() {
  const db = await readDb();
  return db.staff;
}

export async function getUnit(unitId: string): Promise<Unit | null> {
  const db = await readDb();
  return db.units.find((u) => u.id === unitId) || null;
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const db = await readDb();
  return db.bookings.find((b) => b.id === bookingId) || null;
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const db = await readDb();
  return db.customers.find((c) => c.id === customerId) || null;
}

// ============ UI VIEW MODELS ============

function withDetails(db: Database, b: Booking): BookingWithDetails | null {
  const customer = db.customers.find((c) => c.id === b.customerId);
  const unit = db.units.find((u) => u.id === b.unitId);
  return customer && unit ? { ...b, customer, unit } : null;
}

export async function getShellData(): Promise<ShellData> {
  const db = await readDb();
  const todayStr = today();
  const notifications: AppNotification[] = [];
  const customerName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? '';

  for (const b of db.bookings) {
    const customer = db.customers.find((c) => c.id === b.customerId);
    // Shared follow-up actions are copied to every unit line; notify once per booking
    if (ACTIVE_STATUSES.includes(b.status) && b.actionDate && b.actionDate <= todayStr && groupIdOf(b) === b.id) {
      notifications.push({
        id: `action-${b.id}`,
        kind: 'ACTION_OVERDUE',
        title: b.actionDescription || 'Follow-up required',
        description: `${customer?.name ?? 'Unknown customer'} · ${groupLines(db, b.id).map((l) => l.unitId).join(', ')}`,
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
    const due = nextServiceDate(u);
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
    if (u.breakdown) {
      notifications.push({
        id: `breakdown-${u.id}`,
        kind: 'BREAKDOWN',
        title: `Breakdown · ${u.id}`,
        description: u.breakdown.notes || (u.status === 'ON_HIRE' ? 'Broken down on hire' : 'Unit out of action'),
        date: u.breakdown.reportedAt.split('T')[0],
        href: `/units/${u.id}`,
      });
    }
  }
  notifications.sort((a, b) => a.date.localeCompare(b.date));

  const groups = new Map<string, Booking[]>();
  for (const b of db.bookings) groups.set(groupIdOf(b), [...(groups.get(groupIdOf(b)) ?? []), b]);

  return {
    counts: {
      deliveriesToday: db.bookings.filter((b) => b.status === 'CONFIRMED' && b.startDate === todayStr).length,
      collectionsDue: db.bookings.filter((b) => b.status === 'ON_HIRE' && b.endDate <= todayStr).length,
      actionsOverdue: notifications.filter((n) => n.kind === 'ACTION_OVERDUE').length,
      serviceDue: notifications.filter((n) => n.kind === 'SERVICE_DUE' || n.kind === 'BREAKDOWN').length,
    },
    notifications,
    searchIndex: [
      ...db.customers.map((c) => ({
        type: 'customer' as const,
        id: c.id,
        label: c.name,
        sublabel: c.email || c.phone,
        keywords: [c.phone, c.address, c.xeroContactId, ...(c.addresses ?? []).map((a) => `${a.label} ${a.address}`)].join(' '),
        href: `/customers/${c.id}`,
      })),
      ...db.units.map((u) => ({
        type: 'unit' as const,
        id: u.id,
        label: u.id,
        sublabel: `${u.unitType.replace('_', ' ').toLowerCase()} · ${u.breakdown ? 'breakdown' : u.status.replace('_', ' ').toLowerCase()}`,
        keywords: [u.notes, u.dataLoggerId, u.specifications?.chassisNumber].join(' '),
        href: `/units/${u.id}`,
      })),
      ...[...groups.entries()].map(([gid, lines]) => {
        const first = lines[0];
        const status = lines.some((l) => l.status === 'ON_HIRE') ? 'on hire' : lines.some((l) => l.status === 'CONFIRMED') ? 'scheduled' : lines.every((l) => l.status === 'CANCELLED') ? 'cancelled' : 'completed';
        return {
          type: 'booking' as const,
          id: gid,
          label: `${customerName(first.customerId)} · ${lines.map((l) => l.unitId).join(', ')}`,
          sublabel: `${gid} · ${status}`,
          keywords: [first.contactName, first.deliveryAddress, first.quote?.poNumber, first.application, ...lines.map((l) => l.id)].join(' '),
          href: `/bookings/${gid}`,
        };
      }),
      ...db.units.flatMap((u) =>
        (u.bom ?? []).map((c) => ({
          type: 'component' as const,
          id: `${u.id}-${c.id}`,
          label: c.name,
          sublabel: `${u.id} · ${COMPONENT_LABELS[c.type] ?? c.type}`,
          keywords: [c.manufacturer, c.model, c.serialNumber, COMPONENT_LABELS[c.type]].join(' '),
          href: `/units/${u.id}`,
        }))
      ),
      ...db.units.flatMap((u) =>
        (u.maintenanceHistory ?? []).map((r) => ({
          type: 'service' as const,
          id: `${u.id}-${r.id}`,
          label: `${u.id} · ${r.description}`,
          sublabel: `${r.date}${r.orderNumbers?.length ? ` · order ${r.orderNumbers.join(', ')}` : ''}`,
          keywords: [r.performedBy, ...(r.orderNumbers ?? []), ...(r.partsReplaced ?? []), ...(r.attachments ?? []).map((a) => a.name)].join(' '),
          href: `/units/${u.id}`,
        }))
      ),
    ],
  };
}

export async function getDashboardData() {
  const db = await readDb();
  const todayStr = today();
  const tomorrowStr = tomorrow();

  const details = (list: Booking[]) =>
    list.map((b) => withDetails(db, b)).filter((b): b is BookingWithDetails => !!b);

  // Every booking still waiting for delivery (late ones included), one row per booking, soonest first
  const waiting = new Map<string, BookingWithDetails[]>();
  for (const b of details(db.bookings.filter((b) => b.status === 'CONFIRMED').sort((a, b) => a.startDate.localeCompare(b.startDate)))) {
    waiting.set(groupIdOf(b), [...(waiting.get(groupIdOf(b)) ?? []), b]);
  }
  const upcoming = [...waiting.entries()].map(([reference, lines]) => ({ reference, lines, startDate: lines[0].startDate }));

  return {
    units: db.units,
    deliveries: details(
      db.bookings.filter((b) => b.status === 'CONFIRMED' && (b.startDate === todayStr || b.startDate === tomorrowStr))
    ),
    collections: details(db.bookings.filter((b) => b.status === 'ON_HIRE' && b.endDate <= tomorrowStr)),
    upcoming: upcoming.slice(0, 8),
    upcomingTotal: upcoming.length,
    today: todayStr,
    tomorrow: tomorrowStr,
  };
}

/** A booking with all its unit lines; `id` may be any line's id or the booking reference. */
export async function getBookingDetail(id: string) {
  const db = await readDb();
  const lines = groupLines(db, id)
    .map((b) => withDetails(db, b))
    .filter((b): b is BookingWithDetails => !!b);
  if (lines.length === 0) return null;
  const ids = new Set(lines.map((l) => l.id));
  const dockets = db.dockets.filter((d) => ids.has(d.bookingId));
  const pick = (bookingId: string, type: DeliveryDocket['type']) =>
    dockets.find((d) => d.bookingId === bookingId && d.type === type && d.status === 'COMPLETED') ??
    dockets.find((d) => d.bookingId === bookingId && d.type === type);
  const staffName = (sid: string) => db.staff.find((s) => s.id === sid)?.name;
  return {
    reference: groupIdOf(lines[0]),
    booking: lines[0],
    lines: lines.map((l) => ({ ...l, delivery: pick(l.id, 'DELIVERY'), collection: pick(l.id, 'COLLECTION') })),
    staff: Object.fromEntries(dockets.map((d) => [d.staffId, staffName(d.staffId) ?? 'Unassigned'])),
    allStaff: db.staff,
    units: db.units,
  };
}

export async function getCustomerDetail(id: string) {
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDb();
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
  const db = await readDb();
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
