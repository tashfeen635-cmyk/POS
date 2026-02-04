// Mobile Shop Logic - IMEI Management, Warranty Tracking, Trade-ins, Repairs
import { db, SYNC_STATUS, createSyncMetadata, addToSyncQueue, generateOfflineId } from '../db';
import type { LocalIMEI, LocalTradeIn, LocalRepairOrder } from '../db/schema';
import { nanoid } from 'nanoid';

// ==================== IMEI MANAGEMENT ====================

export interface IMEIRegistrationData {
  organizationId: string;
  storeId: string;
  productId: string;
  imei1: string;
  imei2?: string | null;
  serialNumber?: string | null;
  costPrice: number;
  salePrice?: number | null;
  color?: string | null;
  storage?: string | null;
  condition: 'new' | 'refurbished' | 'used';
  supplierId?: string | null;
  warrantyMonths?: number;
  notes?: string | null;
}

// Register a new IMEI
export async function registerIMEI(data: IMEIRegistrationData): Promise<LocalIMEI> {
  // Validate IMEI format (15 digits)
  if (!validateIMEI(data.imei1)) {
    throw new Error('Invalid IMEI1 format. IMEI must be 15 digits.');
  }
  if (data.imei2 && !validateIMEI(data.imei2)) {
    throw new Error('Invalid IMEI2 format. IMEI must be 15 digits.');
  }

  // Check for duplicate IMEI
  const existing = await db.imeiInventory
    .where('imei1')
    .equals(data.imei1)
    .or('imei2')
    .equals(data.imei1)
    .first();

  if (existing) {
    throw new Error(`IMEI ${data.imei1} is already registered.`);
  }

  if (data.imei2) {
    const existingImei2 = await db.imeiInventory
      .where('imei1')
      .equals(data.imei2)
      .or('imei2')
      .equals(data.imei2)
      .first();

    if (existingImei2) {
      throw new Error(`IMEI ${data.imei2} is already registered.`);
    }
  }

  const now = new Date().toISOString();
  const id = generateOfflineId();

  // Calculate warranty expiry
  let warrantyExpiry: string | null = null;
  let warrantyStartDate: string | null = null;
  if (data.warrantyMonths && data.warrantyMonths > 0) {
    warrantyStartDate = now;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + data.warrantyMonths);
    warrantyExpiry = expiryDate.toISOString();
  }

  const imei: LocalIMEI = {
    id,
    organizationId: data.organizationId,
    storeId: data.storeId,
    productId: data.productId,
    imei1: data.imei1,
    imei2: data.imei2 || null,
    serialNumber: data.serialNumber || null,
    status: 'in_stock',
    costPrice: String(data.costPrice),
    salePrice: data.salePrice ? String(data.salePrice) : null,
    color: data.color || null,
    storage: data.storage || null,
    condition: data.condition,
    purchaseDate: now,
    supplierId: data.supplierId || null,
    warrantyExpiry,
    warrantyStartDate,
    soldAt: null,
    saleId: null,
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
    ...createSyncMetadata(),
  };

  await db.imeiInventory.add(imei);
  await addToSyncQueue('imei_inventory', 'create', id, imei as unknown as Record<string, unknown>, 8);

  return imei;
}

// Validate IMEI using Luhn algorithm
export function validateIMEI(imei: string): boolean {
  // Remove any spaces or dashes
  const cleanIMEI = imei.replace(/[\s-]/g, '');

  // IMEI must be 15 digits
  if (!/^\d{15}$/.test(cleanIMEI)) {
    return false;
  }

  // Luhn algorithm check
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleanIMEI[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleanIMEI[14], 10);
}

// Search IMEI by number
export async function searchIMEI(query: string): Promise<LocalIMEI[]> {
  const cleanQuery = query.replace(/[\s-]/g, '');

  return db.imeiInventory
    .filter(
      (imei) =>
        imei.imei1.includes(cleanQuery) ||
        (imei.imei2?.includes(cleanQuery) ?? false) ||
        (imei.serialNumber?.includes(cleanQuery) ?? false)
    )
    .limit(20)
    .toArray();
}

// Get available IMEIs for a product
export async function getAvailableIMEIs(productId: string, storeId?: string): Promise<LocalIMEI[]> {
  let query = db.imeiInventory.where('productId').equals(productId);

  const results = await query.filter((imei) => {
    if (imei.status !== 'in_stock') return false;
    if (storeId && imei.storeId !== storeId) return false;
    return true;
  }).toArray();

  return results;
}

// Mark IMEI as sold
export async function markIMEIAsSold(imeiId: string, saleId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.imeiInventory.update(imeiId, {
    status: 'sold',
    soldAt: now,
    saleId,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'imei_inventory',
    'update',
    imeiId,
    { status: 'sold', soldAt: now, saleId },
    8
  );
}

// Mark IMEI as returned (for sale returns)
export async function markIMEIAsReturned(imeiId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.imeiInventory.update(imeiId, {
    status: 'in_stock',
    soldAt: null,
    saleId: null,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'imei_inventory',
    'update',
    imeiId,
    { status: 'in_stock', soldAt: null, saleId: null },
    8
  );
}

// ==================== WARRANTY TRACKING ====================

export interface WarrantyInfo {
  imeiId: string;
  imei1: string;
  productName: string;
  purchaseDate: string | null;
  warrantyStartDate: string | null;
  warrantyExpiry: string | null;
  hasWarranty: boolean;
  isExpired: boolean;
  daysRemaining: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'no_warranty';
}

// Get warranty info for an IMEI
export async function getWarrantyInfo(imeiId: string): Promise<WarrantyInfo | null> {
  const imei = await db.imeiInventory.get(imeiId);
  if (!imei) return null;

  const product = await db.products.get(imei.productId);

  const today = new Date();
  let hasWarranty = false;
  let isExpired = false;
  let daysRemaining = 0;
  let status: WarrantyInfo['status'] = 'no_warranty';

  if (imei.warrantyExpiry) {
    hasWarranty = true;
    const expiryDate = new Date(imei.warrantyExpiry);
    daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      isExpired = true;
      daysRemaining = 0;
      status = 'expired';
    } else if (daysRemaining <= 30) {
      status = 'expiring_soon';
    } else {
      status = 'active';
    }
  }

  return {
    imeiId: imei.id,
    imei1: imei.imei1,
    productName: product?.name || 'Unknown Product',
    purchaseDate: imei.purchaseDate,
    warrantyStartDate: imei.warrantyStartDate,
    warrantyExpiry: imei.warrantyExpiry,
    hasWarranty,
    isExpired,
    daysRemaining,
    status,
  };
}

// Get all IMEIs with warranty expiring soon
export async function getExpiringWarranties(
  organizationId: string,
  daysThreshold: number = 30
): Promise<WarrantyInfo[]> {
  const today = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  const imeis = await db.imeiInventory
    .where('organizationId')
    .equals(organizationId)
    .filter((imei) => {
      if (!imei.warrantyExpiry) return false;
      if (imei.status !== 'sold') return false; // Only sold items matter for customer warranty

      const expiryDate = new Date(imei.warrantyExpiry);
      return expiryDate >= today && expiryDate <= thresholdDate;
    })
    .toArray();

  const results: WarrantyInfo[] = [];

  for (const imei of imeis) {
    const info = await getWarrantyInfo(imei.id);
    if (info) {
      results.push(info);
    }
  }

  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Extend warranty
export async function extendWarranty(imeiId: string, additionalMonths: number): Promise<void> {
  const imei = await db.imeiInventory.get(imeiId);
  if (!imei) throw new Error('IMEI not found');

  const now = new Date().toISOString();
  let newExpiry: Date;

  if (imei.warrantyExpiry) {
    newExpiry = new Date(imei.warrantyExpiry);
  } else {
    newExpiry = new Date();
  }

  newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

  await db.imeiInventory.update(imeiId, {
    warrantyExpiry: newExpiry.toISOString(),
    warrantyStartDate: imei.warrantyStartDate || now,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'imei_inventory',
    'update',
    imeiId,
    { warrantyExpiry: newExpiry.toISOString(), warrantyStartDate: imei.warrantyStartDate || now },
    5
  );
}

// ==================== TRADE-IN MANAGEMENT ====================

export interface TradeInData {
  organizationId: string;
  storeId: string;
  userId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerCnic?: string | null;
  deviceBrand: string;
  deviceModel: string;
  imei?: string | null;
  serialNumber?: string | null;
  storage?: string | null;
  color?: string | null;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  conditionNotes?: string | null;
  hasOriginalBox: boolean;
  hasCharger: boolean;
  hasAccessories: boolean;
  estimatedValue: number;
  offeredPrice: number;
  notes?: string | null;
}

// Create trade-in record
export async function createTradeIn(data: TradeInData): Promise<LocalTradeIn> {
  const id = generateOfflineId();
  const now = new Date().toISOString();

  // Validate IMEI if provided
  if (data.imei && !validateIMEI(data.imei)) {
    throw new Error('Invalid IMEI format');
  }

  const tradeIn: LocalTradeIn = {
    id,
    organizationId: data.organizationId,
    storeId: data.storeId,
    customerId: data.customerId || null,
    userId: data.userId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerCnic: data.customerCnic || null,
    deviceBrand: data.deviceBrand,
    deviceModel: data.deviceModel,
    imei: data.imei || null,
    serialNumber: data.serialNumber || null,
    storage: data.storage || null,
    color: data.color || null,
    condition: data.condition,
    conditionNotes: data.conditionNotes || null,
    hasOriginalBox: data.hasOriginalBox,
    hasCharger: data.hasCharger,
    hasAccessories: data.hasAccessories,
    estimatedValue: String(data.estimatedValue),
    offeredPrice: String(data.offeredPrice),
    agreedPrice: null,
    status: 'pending',
    saleId: null,
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
    ...createSyncMetadata(),
  };

  await db.tradeIns.add(tradeIn);
  await addToSyncQueue('trade_ins', 'create', id, tradeIn as unknown as Record<string, unknown>, 7);

  return tradeIn;
}

// Update trade-in status
export async function updateTradeInStatus(
  tradeInId: string,
  status: 'pending' | 'approved' | 'rejected' | 'completed',
  agreedPrice?: number
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Partial<LocalTradeIn> = {
    status,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  };

  if (agreedPrice !== undefined) {
    updateData.agreedPrice = String(agreedPrice);
  }

  await db.tradeIns.update(tradeInId, updateData);
  await addToSyncQueue('trade_ins', 'update', tradeInId, updateData as Record<string, unknown>, 7);
}

// Link trade-in to sale (as payment offset)
export async function linkTradeInToSale(tradeInId: string, saleId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.tradeIns.update(tradeInId, {
    saleId,
    status: 'completed',
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue('trade_ins', 'update', tradeInId, { saleId, status: 'completed' }, 8);
}

// Get pending trade-ins
export async function getPendingTradeIns(
  organizationId: string,
  storeId?: string
): Promise<LocalTradeIn[]> {
  return db.tradeIns
    .where('organizationId')
    .equals(organizationId)
    .filter((t) => {
      if (t.status !== 'pending' && t.status !== 'approved') return false;
      if (storeId && t.storeId !== storeId) return false;
      return true;
    })
    .toArray();
}

// ==================== REPAIR ORDER MANAGEMENT ====================

export interface RepairOrderData {
  organizationId: string;
  storeId: string;
  userId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerCnic?: string | null;
  deviceBrand: string;
  deviceModel: string;
  imei?: string | null;
  serialNumber?: string | null;
  password?: string | null;
  issueDescription: string;
  accessories?: string | null;
  deviceCondition?: string | null;
  estimatedCost?: number | null;
  advancePayment?: number;
  estimatedCompletionDate?: string | null;
  notes?: string | null;
}

// Generate repair ticket number
function generateTicketNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `REP-${dateStr}-${nanoid(6).toUpperCase()}`;
}

// Create repair order
export async function createRepairOrder(data: RepairOrderData): Promise<LocalRepairOrder> {
  const id = generateOfflineId();
  const now = new Date().toISOString();
  const ticketNumber = generateTicketNumber();

  // Validate IMEI if provided
  if (data.imei && !validateIMEI(data.imei)) {
    throw new Error('Invalid IMEI format');
  }

  const repairOrder: LocalRepairOrder = {
    id,
    organizationId: data.organizationId,
    storeId: data.storeId,
    ticketNumber,
    customerId: data.customerId || null,
    userId: data.userId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerCnic: data.customerCnic || null,
    deviceBrand: data.deviceBrand,
    deviceModel: data.deviceModel,
    imei: data.imei || null,
    serialNumber: data.serialNumber || null,
    password: data.password || null,
    issueDescription: data.issueDescription,
    accessories: data.accessories || null,
    deviceCondition: data.deviceCondition || null,
    diagnosis: null,
    partsUsed: null,
    estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
    laborCost: null,
    partsCost: null,
    totalCost: null,
    advancePayment: String(data.advancePayment || 0),
    balanceDue: String(data.estimatedCost || 0),
    estimatedCompletionDate: data.estimatedCompletionDate || null,
    completedAt: null,
    deliveredAt: null,
    status: 'received',
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
    ...createSyncMetadata(),
  };

  await db.repairOrders.add(repairOrder);
  await addToSyncQueue('repair_orders', 'create', id, repairOrder as unknown as Record<string, unknown>, 7);

  return repairOrder;
}

// Update repair order status
export async function updateRepairOrderStatus(
  orderId: string,
  status: 'received' | 'diagnosing' | 'waiting_parts' | 'in_progress' | 'completed' | 'delivered' | 'cancelled',
  additionalData?: {
    diagnosis?: string;
    partsUsed?: string;
    laborCost?: number;
    partsCost?: number;
    totalCost?: number;
    notes?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Partial<LocalRepairOrder> = {
    status,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  };

  if (status === 'completed') {
    updateData.completedAt = now;
  }

  if (status === 'delivered') {
    updateData.deliveredAt = now;
  }

  if (additionalData) {
    if (additionalData.diagnosis) updateData.diagnosis = additionalData.diagnosis;
    if (additionalData.partsUsed) updateData.partsUsed = additionalData.partsUsed;
    if (additionalData.laborCost !== undefined) updateData.laborCost = String(additionalData.laborCost);
    if (additionalData.partsCost !== undefined) updateData.partsCost = String(additionalData.partsCost);
    if (additionalData.totalCost !== undefined) {
      updateData.totalCost = String(additionalData.totalCost);
      // Calculate balance due
      const order = await db.repairOrders.get(orderId);
      if (order) {
        const advance = parseFloat(order.advancePayment) || 0;
        updateData.balanceDue = String(Math.max(0, additionalData.totalCost - advance));
      }
    }
    if (additionalData.notes) updateData.notes = additionalData.notes;
  }

  await db.repairOrders.update(orderId, updateData);
  await addToSyncQueue('repair_orders', 'update', orderId, updateData as Record<string, unknown>, 7);
}

// Get repair orders by status
export async function getRepairOrdersByStatus(
  organizationId: string,
  status?: string,
  storeId?: string
): Promise<LocalRepairOrder[]> {
  return db.repairOrders
    .where('organizationId')
    .equals(organizationId)
    .filter((order) => {
      if (status && order.status !== status) return false;
      if (storeId && order.storeId !== storeId) return false;
      return true;
    })
    .toArray();
}

// Search repair order by ticket number or customer phone
export async function searchRepairOrder(query: string): Promise<LocalRepairOrder[]> {
  const cleanQuery = query.toLowerCase().replace(/[\s-]/g, '');

  return db.repairOrders
    .filter(
      (order) =>
        order.ticketNumber.toLowerCase().includes(cleanQuery) ||
        order.customerPhone.replace(/[\s-]/g, '').includes(cleanQuery) ||
        order.customerName.toLowerCase().includes(cleanQuery)
    )
    .limit(20)
    .toArray();
}

// Get repair order stats
export async function getRepairStats(organizationId: string, storeId?: string) {
  const orders = await db.repairOrders
    .where('organizationId')
    .equals(organizationId)
    .filter((o) => !storeId || o.storeId === storeId)
    .toArray();

  const stats = {
    total: orders.length,
    received: 0,
    inProgress: 0,
    completed: 0,
    delivered: 0,
    cancelled: 0,
    waitingParts: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  };

  for (const order of orders) {
    switch (order.status) {
      case 'received':
        stats.received++;
        break;
      case 'diagnosing':
      case 'in_progress':
        stats.inProgress++;
        break;
      case 'waiting_parts':
        stats.waitingParts++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'delivered':
        stats.delivered++;
        stats.totalRevenue += parseFloat(order.totalCost || '0');
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
    }

    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      stats.pendingPayments += parseFloat(order.balanceDue);
    }
  }

  return stats;
}
