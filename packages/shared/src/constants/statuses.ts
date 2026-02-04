// Sale Status
export const SALE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  PARTIALLY_PAID: 'partially_paid',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const;

export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS];

// IMEI Status
export const IMEI_STATUS = {
  IN_STOCK: 'in_stock',
  SOLD: 'sold',
  RETURNED: 'returned',
  DEFECTIVE: 'defective',
  RESERVED: 'reserved',
} as const;

export type IMEIStatus = (typeof IMEI_STATUS)[keyof typeof IMEI_STATUS];

// Repair Status
export const REPAIR_STATUS = {
  RECEIVED: 'received',
  DIAGNOSING: 'diagnosing',
  WAITING_PARTS: 'waiting_parts',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type RepairStatus = (typeof REPAIR_STATUS)[keyof typeof REPAIR_STATUS];

// Trade-In Status
export const TRADE_IN_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const;

export type TradeInStatus = (typeof TRADE_IN_STATUS)[keyof typeof TRADE_IN_STATUS];

// User Roles
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  PHARMACIST: 'pharmacist', // Medical store specific
  TECHNICIAN: 'technician', // Mobile shop specific
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Sync Status (for offline operations)
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  FAILED: 'failed',
  CONFLICT: 'conflict',
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

// Inventory Movement Types
export const INVENTORY_MOVEMENT_TYPES = {
  PURCHASE: 'purchase',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  TRANSFER: 'transfer',
  DAMAGE: 'damage',
  EXPIRED: 'expired',
} as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[keyof typeof INVENTORY_MOVEMENT_TYPES];

// Store Types
export const STORE_TYPES = {
  MOBILE_SHOP: 'mobile_shop',
  MEDICAL_STORE: 'medical_store',
  GENERAL: 'general',
} as const;

export type StoreType = (typeof STORE_TYPES)[keyof typeof STORE_TYPES];
