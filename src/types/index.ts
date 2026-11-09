// Core domain types for Rent-a-Fridge operations

export type UnitStatus = 'AVAILABLE' | 'ON_HIRE' | 'MAINTENANCE';
export type BookingStatus = 'CONFIRMED' | 'ON_HIRE' | 'COLLECTED' | 'CANCELLED';
export type UnitSize = 'SMALL' | 'MEDIUM' | 'LARGE';
/** Site power supply. INDUSTRIAL is shown as 'Commando'; OTHER uses Booking.powerOther. */
export type PowerType = 'STANDARD' | 'INDUSTRIAL' | 'OTHER';
export type RatePeriod = 'DAY' | 'WEEK';
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

export interface PostalAddress {
  line1: string;
  line2?: string;
  town?: string;
  county?: string;
  postcode: string;
  country: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string; // Default/primary invoice address, formatted on one line
  invoiceAddress?: PostalAddress; // Structured invoice address (source of `address` when set)
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
  type: 'COMPRESSOR' | 'EVAPORATOR' | 'CONTROLLER' | 'FAN_MOTOR' | 'CONTACTOR' | 'OTHER';
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
  /** Legacy: cost was replaced by order numbers */
  cost?: number;
  orderNumbers?: string[];
  hoursWorked?: number;
  partsReplaced?: string[];
  nextServiceDate?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface Unit {
  id: string;
  size: UnitSize;
  /** Legacy: power is a cable chosen per booking, not a property of the unit */
  powerType?: PowerType;
  unitType: UnitType; // cold store, upright fridge, chest freezer
  status: UnitStatus;
  currentBookingId?: string;
  notes?: string;
  specifications?: UnitSpecifications;
  bom?: BOMComponent[];
  maintenanceHistory?: MaintenanceRecord[];
  dataLoggerId?: string; // For data logger integration
  /** Set when the unit has broken down; blocks new bookings until cleared. Can be set while on hire. */
  breakdown?: { reportedAt: string; notes?: string };
  /** Manually scheduled next service, overriding the date from the last service record */
  nextServiceDate?: string;
  createdAt?: string;
}

export interface BookingAccessories {
  hitchLock: boolean;
  wheelClamp: boolean;
  doorLock: boolean;
  tempRecorder: boolean;
}

export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // GBP, ex VAT
}

/** Booking-level pricing shared by every unit line of a booking. */
export interface BookingQuote {
  extras: QuoteLine[];
  discount?: number; // GBP off the subtotal, ex VAT
  vatRate: number; // percent, e.g. 20
  poNumber?: string;
}

/**
 * One unit on hire. A booking with several units is several Booking records sharing a
 * groupId (the id of the first unit line); customer, site, contact and quote are kept
 * identical across the group, while dates, status and jobs are per unit.
 */
export interface Booking {
  id: string;
  groupId?: string;
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
  what3wordsAddress?: string; // ///word.word.word for the exact drop-off spot
  accessInstructions?: string;
  tempRequired: number; // celsius
  powerAvailable: PowerType;
  powerOther?: string; // Free text when powerAvailable is OTHER
  cableLength?: CableLength;
  accessories?: BookingAccessories;
  rate?: number; // GBP ex VAT per ratePeriod for this unit
  ratePeriod?: RatePeriod;
  quote?: BookingQuote;
  application?: string; // e.g., "fish", "ice cream", "pizza dough"
  notes?: string; // Free-text notes
  createdAt: string; // YYYY-MM-DD
  deliveryDocketId?: string;
  collectionDocketId?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  cancelledAt?: string; // ISO timestamp
  cancellationReason?: string;
}

export interface ServiceableComponent {
  id: string;
  type: BOMComponent['type'];
  name: string;
  description?: string;
  intervalMonths: number;
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
  tempRecorderFitted?: boolean;
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
  serviceableComponents?: ServiceableComponent[];
}

// Input types for actions

/** Fields shared by every unit line of a booking. */
export interface BookingSharedInput {
  customerId: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryAddressId?: string;
  what3wordsAddress?: string;
  accessInstructions?: string;
  powerAvailable: PowerType;
  powerOther?: string;
  application?: string;
  notes?: string;
  actionDate?: string;
  actionDescription?: string;
  quote?: BookingQuote;
}

/** Per-unit fields of a booking line. */
export interface BookingLineInput {
  unitId: string;
  startDate: string;
  endDate: string;
  deliveryTime?: string;
  collectionTime?: string;
  tempRequired: number;
  cableLength?: CableLength;
  accessories?: BookingAccessories;
  rate?: number;
  ratePeriod?: RatePeriod;
}

export type CreateBookingInput = BookingSharedInput & { lines: BookingLineInput[] };

/** Lines with an id update that unit line; lines without one are added to the booking. */
export interface UpdateBookingGroupInput {
  shared: Omit<BookingSharedInput, 'customerId'>;
  lines: (BookingLineInput & { id?: string })[];
  /** Not-yet-delivered unit lines to cancel (remove from the booking) */
  cancelIds?: string[];
}

export interface MarkDeliveredInput {
  bookingId: string;
  staffId: string;
  checklist: DeliveryDocket['checklist'];
  tempSet: number;
  damageNotes?: string;
  signedBy: string;
  signatureData?: string;
  what3wordsAddress?: string;
  photoUrls: string[];
}

export type MarkCollectedInput = MarkDeliveredInput;

export interface UnitSpec {
  size?: UnitSize;
}

// View models for UI
export type BookingWithDetails = Booking & { customer: Customer; unit: Unit };

export interface AppNotification {
  id: string;
  kind: 'ACTION_OVERDUE' | 'COLLECTION_OVERDUE' | 'SERVICE_DUE' | 'BREAKDOWN';
  title: string;
  description: string;
  date: string;
  href: string;
}

export interface ShellData {
  counts: { deliveriesToday: number; collectionsDue: number; actionsOverdue: number; serviceDue: number };
  notifications: AppNotification[];
  searchIndex: { type: 'customer' | 'unit' | 'booking' | 'component' | 'service'; id: string; label: string; sublabel: string; keywords?: string; href: string }[];
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
