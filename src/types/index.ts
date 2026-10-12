// Core domain types for Rent-a-Fridge operations

export type UnitStatus = 'AVAILABLE' | 'ON_HIRE' | 'MAINTENANCE';
export type BookingStatus = 'CONFIRMED' | 'ON_HIRE' | 'COLLECTED';
export type UnitSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type PowerType = 'STANDARD' | 'INDUSTRIAL';

export interface Staff {
  id: string;
  name: string;
  role: 'DRIVER' | 'ADMIN' | 'MANAGER';
  phone: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  createdAt: string; // YYYY-MM-DD
}

export interface Unit {
  id: string;
  size: UnitSize;
  powerType: PowerType;
  status: UnitStatus;
  currentBookingId?: string;
  notes?: string;
}

export interface Booking {
  id: string;
  customerId: string;
  unitId: string;
  status: BookingStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  accessInstructions?: string;
  tempRequired: number; // celsius
  powerAvailable: PowerType;
  createdAt: string; // YYYY-MM-DD
  deliveryDocketId?: string;
  collectionDocketId?: string;
}

export interface DeliveryDocket {
  id: string;
  bookingId: string;
  unitId: string;
  type: 'DELIVERY' | 'COLLECTION';
  date: string; // YYYY-MM-DD
  staffId: string;
  checklist: {
    unitClean: boolean;
    doorsSealed: boolean;
    tempVerified: boolean;
    powerConnected: boolean;
  };
  tempSet: number;
  damageNotes?: string;
  signedBy: string;
  photoUrls: string[];
  completedAt: string; // ISO timestamp
}

export interface Database {
  staff: Staff[];
  customers: Customer[];
  units: Unit[];
  bookings: Booking[];
  dockets: DeliveryDocket[];
}

// Input types for actions
export interface CreateBookingInput {
  customerId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  accessInstructions?: string;
  tempRequired: number;
  powerAvailable: PowerType;
}

export interface MarkDeliveredInput {
  bookingId: string;
  staffId: string;
  checklist: DeliveryDocket['checklist'];
  tempSet: number;
  damageNotes?: string;
  signedBy: string;
  photoUrls: string[];
}

export interface MarkCollectedInput {
  bookingId: string;
  staffId: string;
  checklist: DeliveryDocket['checklist'];
  tempSet: number;
  damageNotes?: string;
  signedBy: string;
  photoUrls: string[];
}

export interface UnitSpec {
  size?: UnitSize;
  powerType?: PowerType;
}
