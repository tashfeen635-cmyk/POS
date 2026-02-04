// Enhanced IndexedDB Schema with complete sync support
import Dexie, { type EntityTable } from 'dexie';

// Sync status enum
export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
  CONFLICT: 'conflict',
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

// Base sync metadata
export interface SyncMetadata {
  _syncStatus: SyncStatus;
  _clientId: string;
  _clientCreatedAt: string;
  _clientUpdatedAt: string;
  _serverSyncedAt: string | null;
  _syncAttempts: number;
  _lastSyncError: string | null;
  _conflictData: Record<string, unknown> | null;
  _version: number; // For optimistic locking
}

// Helper to create default sync metadata for synced items from server
export function createSyncedMetadata(): SyncMetadata {
  const now = new Date().toISOString();
  return {
    _syncStatus: SYNC_STATUS.SYNCED,
    _clientId: localStorage.getItem('clientId') || '',
    _clientCreatedAt: now,
    _clientUpdatedAt: now,
    _serverSyncedAt: now,
    _syncAttempts: 0,
    _lastSyncError: null,
    _conflictData: null,
    _version: 1,
  };
}

// Helper to create default sync metadata for new pending items
export function createPendingMetadata(): SyncMetadata {
  const now = new Date().toISOString();
  return {
    _syncStatus: SYNC_STATUS.PENDING,
    _clientId: localStorage.getItem('clientId') || '',
    _clientCreatedAt: now,
    _clientUpdatedAt: now,
    _serverSyncedAt: null,
    _syncAttempts: 0,
    _lastSyncError: null,
    _conflictData: null,
    _version: 1,
  };
}

// Local entities with sync metadata
export interface LocalProduct extends SyncMetadata {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  productType: string;
  costPrice: string;
  salePrice: string;
  wholesalePrice: string | null;
  minSalePrice: string | null;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  unit: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  storage: string | null;
  ram: string | null;
  warrantyDays: number | null;
  genericName: string | null;
  manufacturer: string | null;
  schedule: string | null;
  dosageForm: string | null;
  strength: string | null;
  packSize: number | null;
  unitsPerPack: number | null;
  requiresPrescription: boolean;
  isActive: boolean;
  trackInventory: boolean;
  allowDiscount: boolean;
  taxRate: string;
  description: string | null;
  notes: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCategory extends SyncMetadata {
  id: string;
  organizationId: string;
  name: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCustomer extends SyncMetadata {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  creditLimit: string;
  currentBalance: string;
  totalPurchases: string;
  totalPaid: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalIMEI extends SyncMetadata {
  id: string;
  organizationId: string;
  storeId: string;
  productId: string;
  imei1: string;
  imei2: string | null;
  serialNumber: string | null;
  status: string;
  costPrice: string;
  salePrice: string | null;
  color: string | null;
  storage: string | null;
  condition: string;
  purchaseDate: string | null;
  supplierId: string | null;
  warrantyExpiry: string | null;
  warrantyStartDate: string | null;
  soldAt: string | null;
  saleId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalBatch extends SyncMetadata {
  id: string;
  organizationId: string;
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  manufacturingDate: string | null;
  quantity: number;
  soldQuantity: number;
  costPrice: string;
  salePrice: string | null;
  mrp: string | null;
  supplierId: string | null;
  purchaseDate: string | null;
  isBlocked: boolean; // For expired batches
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSale extends SyncMetadata {
  id: string;
  offlineId: string;
  organizationId: string;
  storeId: string;
  invoiceNumber: string;
  customerId: string | null;
  userId: string;
  items: LocalSaleItem[];
  payments: LocalSalePayment[];
  subtotal: string;
  discount: string;
  discountPercent: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  dueAmount: string;
  status: string;
  notes: string | null;
  receiptPrinted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSaleItem {
  id: string;
  productId: string;
  productName: string; // Denormalized for offline display
  imeiId: string | null;
  imeiNumber: string | null; // Denormalized
  batchId: string | null;
  batchNumber: string | null; // Denormalized
  quantity: number;
  unitPrice: string;
  costPrice: string;
  discount: string;
  discountPercent: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
  total: string;
  notes: string | null;
}

export interface LocalSalePayment {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  tradeInId: string | null;
  notes: string | null;
}

export interface LocalTradeIn extends SyncMetadata {
  id: string;
  organizationId: string;
  storeId: string;
  customerId: string | null;
  userId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerCnic: string | null;
  deviceBrand: string;
  deviceModel: string;
  imei: string | null;
  serialNumber: string | null;
  storage: string | null;
  color: string | null;
  condition: string;
  conditionNotes: string | null;
  hasOriginalBox: boolean;
  hasCharger: boolean;
  hasAccessories: boolean;
  estimatedValue: string;
  offeredPrice: string;
  agreedPrice: string | null;
  status: string;
  saleId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalRepairOrder extends SyncMetadata {
  id: string;
  organizationId: string;
  storeId: string;
  ticketNumber: string;
  customerId: string | null;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerCnic: string | null;
  deviceBrand: string;
  deviceModel: string;
  imei: string | null;
  serialNumber: string | null;
  password: string | null;
  issueDescription: string;
  accessories: string | null;
  deviceCondition: string | null;
  diagnosis: string | null;
  partsUsed: string | null;
  estimatedCost: string | null;
  laborCost: string | null;
  partsCost: string | null;
  totalCost: string | null;
  advancePayment: string;
  balanceDue: string;
  estimatedCompletionDate: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Sync Queue with enhanced tracking
export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  data: Record<string, unknown>;
  priority: number; // Higher = more urgent (sales have highest)
  timestamp: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  createdAt: string;
}

// App settings
export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

// Offline receipts queue
export interface OfflineReceipt {
  id?: number;
  saleId: string;
  invoiceNumber: string;
  receiptHtml: string;
  printStatus: 'pending' | 'printed' | 'failed';
  printAttempts: number;
  createdAt: string;
}

// Database class
class POSDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>;
  categories!: EntityTable<LocalCategory, 'id'>;
  customers!: EntityTable<LocalCustomer, 'id'>;
  imeiInventory!: EntityTable<LocalIMEI, 'id'>;
  productBatches!: EntityTable<LocalBatch, 'id'>;
  sales!: EntityTable<LocalSale, 'id'>;
  tradeIns!: EntityTable<LocalTradeIn, 'id'>;
  repairOrders!: EntityTable<LocalRepairOrder, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  settings!: EntityTable<AppSetting, 'key'>;
  offlineReceipts!: EntityTable<OfflineReceipt, 'id'>;

  constructor() {
    super('pos-db-v2');

    this.version(1).stores({
      products: 'id, organizationId, categoryId, sku, barcode, name, productType, isActive, _syncStatus, updatedAt',
      categories: 'id, organizationId, parentId, name, _syncStatus',
      customers: 'id, organizationId, phone, name, _syncStatus',
      imeiInventory: 'id, organizationId, storeId, productId, imei1, imei2, status, _syncStatus, warrantyExpiry',
      productBatches: 'id, organizationId, storeId, productId, batchNumber, expiryDate, isBlocked, _syncStatus',
      sales: 'id, offlineId, organizationId, storeId, invoiceNumber, customerId, status, _syncStatus, createdAt',
      tradeIns: 'id, organizationId, storeId, customerId, status, _syncStatus, createdAt',
      repairOrders: 'id, organizationId, storeId, ticketNumber, customerId, status, _syncStatus, createdAt',
      syncQueue: '++id, table, recordId, status, priority, nextRetryAt, createdAt',
      settings: 'key',
      offlineReceipts: '++id, saleId, invoiceNumber, printStatus, createdAt',
    });
  }
}

export const db = new POSDatabase();

// Utility to generate client IDs
export function generateClientId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility to create sync metadata
export function createSyncMetadata(): SyncMetadata {
  const now = new Date().toISOString();
  return {
    _syncStatus: SYNC_STATUS.PENDING,
    _clientId: localStorage.getItem('clientId') || generateClientId(),
    _clientCreatedAt: now,
    _clientUpdatedAt: now,
    _serverSyncedAt: null,
    _syncAttempts: 0,
    _lastSyncError: null,
    _conflictData: null,
    _version: 1,
  };
}

// Get sync status summary
export async function getSyncStatus() {
  const [
    pendingProducts,
    pendingCustomers,
    pendingSales,
    pendingIMEIs,
    pendingBatches,
    pendingTradeIns,
    pendingRepairs,
    queuePending,
    queueFailed,
  ] = await Promise.all([
    db.products.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.customers.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.sales.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.imeiInventory.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.productBatches.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.tradeIns.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.repairOrders.where('_syncStatus').equals(SYNC_STATUS.PENDING).count(),
    db.syncQueue.where('status').equals('pending').count(),
    db.syncQueue.where('status').equals('failed').count(),
  ]);

  return {
    pendingProducts,
    pendingCustomers,
    pendingSales,
    pendingIMEIs,
    pendingBatches,
    pendingTradeIns,
    pendingRepairs,
    queuePending,
    queueFailed,
    totalPending:
      pendingProducts +
      pendingCustomers +
      pendingSales +
      pendingIMEIs +
      pendingBatches +
      pendingTradeIns +
      pendingRepairs +
      queuePending,
  };
}
