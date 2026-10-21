// Core domain types for Rent-a-Fridge operations

export type UnitStatus = 'AVAILABLE' | 'ON_HIRE' | 'MAINTENANCE';
export type BookingStatus = 'CONFIRMED' | 'ON_HIRE' | 'COLLECTED';
export type UnitSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type PowerType = 'STANDARD' | 'INDUSTRIAL';
export type UnitType = 'COLD_STORE' | 'UPRIGHT_FRIDGE' | 'CHEST_FREEZER';
export type CableLength = '5m' | '10m' | '15m' | '20m' | '25m' | '30m';
export type CalendarView = 'week' | 'month';

export interface Staff {
  id: string;
  name: string;
  role: 'DRIVER' | 'ADMIN' | 'MANAGER';
  phone: string;
}

export interface CustomerAddress {
  id: string;
  label: string; // e.g., "Main Office", "Warehouse"
  address: string;
  isDefault?: boolean;
}

export interface CustomerPreferences {
  preferredUnitId?: string; // Preferred cold store/unit
  preferredUnitType?: UnitType;
  preferredCableLength?: CableLength;
  defaultTempRequired?: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string; // Default/primary invoice address
  addresses?: CustomerAddress[]; // Additional delivery addresses
  preferences?: CustomerPreferences;
  xeroContactId?: string; // Link to Xero accounting
  createdAt: string; // YYYY-MM-DD
}

export interface UnitDimensions {
  length: number; // mm
  width: number; // mm
  height: number; // mm
}

export interface UnitSpecifications {
  externalDimensions?: UnitDimensions;
  internalDimensions?: UnitDimensions;
  cubicCapacity?: number; // cubic meters
  doorAccess?: string; // e.g., "Rear doors", "Side access"
  chassisNumber?: string;
  photoUrls?: string[];
}

export interface BOMComponent {
  id: string;
  type: 'COMPRESSOR' | 'EVAPORATOR' | 'CONTROLLER' | 'FAN_MOTOR' | 'OTHER';
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedDate?: string;
  warrantyExpiry?: string;
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'SCHEDULED' | 'REPAIR' | 'INSPECTION';
  description: string;
  performedBy: string;
  cost?: number;
  partsReplaced?: string[];
  nextServiceDate?: string;
}

export interface Unit {
  id: string;
  size: UnitSize;
  powerType: PowerType;
  unitType: UnitType; // cold store, upright fridge, chest freezer
  status: UnitStatus;
  currentBookingId?: string;
  notes?: string;
  specifications?: UnitSpecifications;
  bom?: BOMComponent[];
  maintenanceHistory?: MaintenanceRecord[];
  dataLoggerId?: string; // For data logger integration
  createdAt?: string;
}

export interface BookingAccessories {
  hitchLock: boolean;
  wheelClamp: boolean;
  doorLock: boolean;
  tempRecorder: boolean;
}

export interface Booking {
  id: string;
  customerId: string;
  unitId: string;
  status: BookingStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  deliveryTime?: string; // HH:MM format
  collectionTime?: string; // HH:MM format
  actionDate?: string; // YYYY-MM-DD - date by which action must be taken
  actionDescription?: string; // Description of the required action
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryAddressId?: string; // Reference to CustomerAddress
  accessInstructions?: string;
  tempRequired: number; // celsius
  powerAvailable: PowerType;
  cableLength?: CableLength;
  accessories?: BookingAccessories;
  application?: string; // e.g., "fish", "ice cream", "pizza dough"
  notes?: string; // Free-text notes
  createdAt: string; // YYYY-MM-DD
  deliveryDocketId?: string;
  collectionDocketId?: string;
  emailSent?: boolean;
  smsSent?: boolean;
}

export interface DeliveryChecklist {
  unitClean: boolean;
  doorsSealed: boolean;
  tempVerified: boolean;
  powerConnected: boolean;
  // Enhanced checklist items
  tempSetting: number; // Temperature set
  powerSupplyChecked: boolean;
  powerCableConnected: boolean;
  cableLengthUsed?: CableLength;
  hitchLockSecured: boolean;
  wheelClampSecured: boolean;
  doorLockSecured: boolean;
}

export interface DeliveryDocket {
  id: string;
  bookingId: string;
  unitId: string;
  type: 'DELIVERY' | 'COLLECTION';
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  staffId: string;
  checklist: DeliveryChecklist;
  tempSet: number;
  damageNotes?: string;
  signedBy: string;
  signatureData?: string; // Base64 signature image
  photoUrls: string[];
  what3wordsAddress?: string; // What3words location
  completedAt?: string; // ISO timestamp - optional until completed
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
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
  deliveryTime?: string;
  collectionTime?: string;
  actionDate?: string;
  actionDescription?: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryAddressId?: string;
  accessInstructions?: string;
  tempRequired: number;
  powerAvailable: PowerType;
  cableLength?: CableLength;
  accessories?: BookingAccessories;
  application?: string;
  notes?: string;
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

// View models for UI
export type BookingWithDetails = Booking & { customer: Customer; unit: Unit };

export interface AppNotification {
  id: string;
  kind: 'ACTION_OVERDUE' | 'COLLECTION_OVERDUE' | 'SERVICE_DUE';
  title: string;
  description: string;
  date: string;
  href: string;
}

export interface ShellData {
  counts: { deliveriesToday: number; collectionsDue: number; actionsOverdue: number; serviceDue: number };
  notifications: AppNotification[];
  searchIndex: { type: 'customer' | 'unit' | 'booking'; id: string; label: string; sublabel: string; href: string }[];
}

export type CustomerWithStats = Customer & {
  activeHires: number;
  totalBookings: number;
  lastBookingDate?: string;
};

export type UnitWithHire = Unit & {
  currentHire?: { bookingId: string; customerName: string; customerId: string; endDate: string; startDate: string };
  nextBooking?: { bookingId: string; customerName: string; startDate: string };
};
