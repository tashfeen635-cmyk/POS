// Medical Store Logic - Batch & Expiry Tracking, FEFO Rules, Expired Product Blocking
import { db, SYNC_STATUS, createSyncMetadata, addToSyncQueue, generateOfflineId } from '../db';
import type { LocalBatch, LocalProduct } from '../db/schema';

// ==================== BATCH MANAGEMENT ====================

export interface BatchRegistrationData {
  organizationId: string;
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string; // ISO date string
  manufacturingDate?: string | null;
  quantity: number;
  costPrice: number;
  salePrice?: number | null;
  mrp?: number | null;
  supplierId?: string | null;
  notes?: string | null;
}

// Register a new batch
export async function registerBatch(data: BatchRegistrationData): Promise<LocalBatch> {
  // Validate expiry date is in the future
  const expiryDate = new Date(data.expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate < today) {
    throw new Error('Cannot register batch with past expiry date');
  }

  // Check for duplicate batch number for same product in same store
  const existing = await db.productBatches
    .where(['productId', 'storeId', 'batchNumber'])
    .equals([data.productId, data.storeId, data.batchNumber])
    .first();

  if (existing) {
    throw new Error(`Batch ${data.batchNumber} already exists for this product in this store`);
  }

  const id = generateOfflineId();
  const now = new Date().toISOString();

  const batch: LocalBatch = {
    id,
    organizationId: data.organizationId,
    storeId: data.storeId,
    productId: data.productId,
    batchNumber: data.batchNumber,
    expiryDate: data.expiryDate,
    manufacturingDate: data.manufacturingDate || null,
    quantity: data.quantity,
    soldQuantity: 0,
    costPrice: String(data.costPrice),
    salePrice: data.salePrice ? String(data.salePrice) : null,
    mrp: data.mrp ? String(data.mrp) : null,
    supplierId: data.supplierId || null,
    purchaseDate: now,
    isBlocked: false,
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
    ...createSyncMetadata(),
  };

  await db.productBatches.add(batch);
  await addToSyncQueue('product_batches', 'create', id, batch as unknown as Record<string, unknown>, 8);

  // Update product stock quantity
  const product = await db.products.get(data.productId);
  if (product && product.trackInventory) {
    await db.products.update(data.productId, {
      stockQuantity: product.stockQuantity + data.quantity,
      updatedAt: now,
      _syncStatus: SYNC_STATUS.PENDING,
      _clientUpdatedAt: now,
    });
  }

  return batch;
}

// Get available batches for a product (FEFO sorted)
export async function getAvailableBatches(
  productId: string,
  storeId?: string,
  quantity?: number
): Promise<LocalBatch[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let batches = await db.productBatches
    .where('productId')
    .equals(productId)
    .filter((batch) => {
      // Filter out blocked batches
      if (batch.isBlocked) return false;

      // Filter by store if provided
      if (storeId && batch.storeId !== storeId) return false;

      // Filter out expired batches
      const expiryDate = new Date(batch.expiryDate);
      if (expiryDate < today) return false;

      // Filter out fully sold batches
      const available = batch.quantity - batch.soldQuantity;
      if (available <= 0) return false;

      return true;
    })
    .toArray();

  // Sort by expiry date (FEFO - First Expiry First Out)
  batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return batches;
}

// Get batches with FEFO selection for a specific quantity
export async function selectBatchesFEFO(
  productId: string,
  requiredQuantity: number,
  storeId?: string
): Promise<Array<{ batch: LocalBatch; quantity: number }>> {
  const availableBatches = await getAvailableBatches(productId, storeId);

  const selections: Array<{ batch: LocalBatch; quantity: number }> = [];
  let remaining = requiredQuantity;

  for (const batch of availableBatches) {
    if (remaining <= 0) break;

    const available = batch.quantity - batch.soldQuantity;
    const toTake = Math.min(available, remaining);

    if (toTake > 0) {
      selections.push({ batch, quantity: toTake });
      remaining -= toTake;
    }
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock. Missing ${remaining} units.`);
  }

  return selections;
}

// Sell from batch (update sold quantity)
export async function sellFromBatch(batchId: string, quantity: number): Promise<void> {
  const batch = await db.productBatches.get(batchId);
  if (!batch) throw new Error('Batch not found');

  const available = batch.quantity - batch.soldQuantity;
  if (quantity > available) {
    throw new Error(`Insufficient batch stock. Available: ${available}, Requested: ${quantity}`);
  }

  const now = new Date().toISOString();
  const newSoldQuantity = batch.soldQuantity + quantity;

  await db.productBatches.update(batchId, {
    soldQuantity: newSoldQuantity,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'product_batches',
    'update',
    batchId,
    { soldQuantity: newSoldQuantity },
    8
  );
}

// Return to batch (for sale returns)
export async function returnToBatch(batchId: string, quantity: number): Promise<void> {
  const batch = await db.productBatches.get(batchId);
  if (!batch) throw new Error('Batch not found');

  const now = new Date().toISOString();
  const newSoldQuantity = Math.max(0, batch.soldQuantity - quantity);

  await db.productBatches.update(batchId, {
    soldQuantity: newSoldQuantity,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'product_batches',
    'update',
    batchId,
    { soldQuantity: newSoldQuantity },
    8
  );
}

// ==================== EXPIRY MANAGEMENT ====================

export interface ExpiryAlert {
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  availableQuantity: number;
  status: 'expired' | 'critical' | 'warning' | 'normal';
  isBlocked: boolean;
}

// Get expiry alerts
export async function getExpiryAlerts(
  organizationId: string,
  options: {
    storeId?: string;
    criticalDays?: number; // Red alert threshold (default: 30)
    warningDays?: number; // Yellow alert threshold (default: 90)
    includeExpired?: boolean;
  } = {}
): Promise<ExpiryAlert[]> {
  const { storeId, criticalDays = 30, warningDays = 90, includeExpired = true } = options;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const criticalDate = new Date(today);
  criticalDate.setDate(criticalDate.getDate() + criticalDays);

  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + warningDays);

  const batches = await db.productBatches
    .where('organizationId')
    .equals(organizationId)
    .filter((batch) => {
      if (storeId && batch.storeId !== storeId) return false;

      const available = batch.quantity - batch.soldQuantity;
      if (available <= 0) return false;

      const expiryDate = new Date(batch.expiryDate);

      if (!includeExpired && expiryDate < today) return false;

      // Include if expired or within warning period
      return expiryDate <= warningDate;
    })
    .toArray();

  const alerts: ExpiryAlert[] = [];

  for (const batch of batches) {
    const product = await db.products.get(batch.productId);
    const expiryDate = new Date(batch.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: ExpiryAlert['status'] = 'normal';
    if (daysUntilExpiry < 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= criticalDays) {
      status = 'critical';
    } else if (daysUntilExpiry <= warningDays) {
      status = 'warning';
    }

    alerts.push({
      batchId: batch.id,
      productId: batch.productId,
      productName: product?.name || 'Unknown Product',
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
      availableQuantity: batch.quantity - batch.soldQuantity,
      status,
      isBlocked: batch.isBlocked,
    });
  }

  // Sort by days until expiry (most urgent first)
  alerts.sort((a, b) => {
    if (a.status === 'expired' && b.status !== 'expired') return -1;
    if (b.status === 'expired' && a.status !== 'expired') return 1;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });

  return alerts;
}

// Block expired batches (run periodically)
export async function blockExpiredBatches(organizationId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();

  let query = db.productBatches.toCollection();

  if (organizationId) {
    query = db.productBatches.where('organizationId').equals(organizationId);
  }

  const expiredBatches = await query
    .filter((batch) => {
      if (batch.isBlocked) return false;
      const expiryDate = new Date(batch.expiryDate);
      return expiryDate < today;
    })
    .toArray();

  let blocked = 0;

  for (const batch of expiredBatches) {
    await db.productBatches.update(batch.id, {
      isBlocked: true,
      updatedAt: now,
      _syncStatus: SYNC_STATUS.PENDING,
      _clientUpdatedAt: now,
    });

    await addToSyncQueue(
      'product_batches',
      'update',
      batch.id,
      { isBlocked: true },
      5
    );

    blocked++;
  }

  if (blocked > 0) {
    console.log(`[Medical] Blocked ${blocked} expired batches`);
  }

  return blocked;
}

// Manually block/unblock a batch
export async function setBatchBlockStatus(batchId: string, isBlocked: boolean): Promise<void> {
  const now = new Date().toISOString();

  await db.productBatches.update(batchId, {
    isBlocked,
    updatedAt: now,
    _syncStatus: SYNC_STATUS.PENDING,
    _clientUpdatedAt: now,
  });

  await addToSyncQueue(
    'product_batches',
    'update',
    batchId,
    { isBlocked },
    5
  );
}

// ==================== STRIP SALES (PARTIAL PACK SALES) ====================

export interface StripSaleInfo {
  productId: string;
  productName: string;
  packSize: number;
  unitsPerPack: number;
  pricePerUnit: number;
  pricePerStrip: number;
  unitsPerStrip: number;
  availableUnits: number;
  availableStrips: number;
}

// Get strip sale information for a product
export async function getStripSaleInfo(
  productId: string,
  storeId?: string
): Promise<StripSaleInfo | null> {
  const product = await db.products.get(productId);
  if (!product) return null;

  // Only applicable to medicine products with pack configuration
  if (!product.packSize || !product.unitsPerPack) return null;

  const availableBatches = await getAvailableBatches(productId, storeId);
  const totalAvailable = availableBatches.reduce(
    (sum, b) => sum + (b.quantity - b.soldQuantity),
    0
  );

  const totalUnits = totalAvailable * (product.unitsPerPack || 1);
  const pricePerPack = parseFloat(product.salePrice);
  const pricePerUnit = pricePerPack / (product.unitsPerPack || 1);

  // Standard strip size is typically 10 units
  const unitsPerStrip = 10;
  const pricePerStrip = pricePerUnit * unitsPerStrip;
  const availableStrips = Math.floor(totalUnits / unitsPerStrip);

  return {
    productId: product.id,
    productName: product.name,
    packSize: product.packSize,
    unitsPerPack: product.unitsPerPack,
    pricePerUnit: Math.round(pricePerUnit * 100) / 100,
    pricePerStrip: Math.round(pricePerStrip * 100) / 100,
    unitsPerStrip,
    availableUnits: totalUnits,
    availableStrips,
  };
}

// Calculate price for partial quantity sale
export function calculatePartialSalePrice(
  pricePerPack: number,
  unitsPerPack: number,
  quantityUnits: number
): number {
  const pricePerUnit = pricePerPack / unitsPerPack;
  return Math.round(pricePerUnit * quantityUnits * 100) / 100;
}

// ==================== INVENTORY REPORTS ====================

export interface BatchInventoryReport {
  productId: string;
  productName: string;
  totalBatches: number;
  totalQuantity: number;
  totalSold: number;
  totalAvailable: number;
  totalValue: number;
  expiredQuantity: number;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
  batches: Array<{
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    available: number;
    status: string;
    value: number;
  }>;
}

// Get batch inventory report for a product
export async function getBatchInventoryReport(
  productId: string,
  storeId?: string
): Promise<BatchInventoryReport | null> {
  const product = await db.products.get(productId);
  if (!product) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date30 = new Date(today);
  date30.setDate(date30.getDate() + 30);

  const date90 = new Date(today);
  date90.setDate(date90.getDate() + 90);

  const batches = await db.productBatches
    .where('productId')
    .equals(productId)
    .filter((b) => !storeId || b.storeId === storeId)
    .toArray();

  const report: BatchInventoryReport = {
    productId,
    productName: product.name,
    totalBatches: batches.length,
    totalQuantity: 0,
    totalSold: 0,
    totalAvailable: 0,
    totalValue: 0,
    expiredQuantity: 0,
    expiringWithin30Days: 0,
    expiringWithin90Days: 0,
    batches: [],
  };

  for (const batch of batches) {
    const available = batch.quantity - batch.soldQuantity;
    const expiryDate = new Date(batch.expiryDate);
    const costPrice = parseFloat(batch.costPrice);

    let status = 'available';
    if (batch.isBlocked) {
      status = 'blocked';
    } else if (expiryDate < today) {
      status = 'expired';
      report.expiredQuantity += available;
    } else if (expiryDate <= date30) {
      status = 'expiring_soon';
      report.expiringWithin30Days += available;
    } else if (expiryDate <= date90) {
      status = 'expiring';
      report.expiringWithin90Days += available;
    }

    report.totalQuantity += batch.quantity;
    report.totalSold += batch.soldQuantity;
    report.totalAvailable += available;

    if (status !== 'expired' && !batch.isBlocked) {
      report.totalValue += available * costPrice;
    }

    report.batches.push({
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      available,
      status,
      value: available * costPrice,
    });
  }

  // Sort batches by expiry date
  report.batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return report;
}

// Get overall expiry summary
export async function getExpirySummary(
  organizationId: string,
  storeId?: string
): Promise<{
  totalExpired: number;
  totalExpiredValue: number;
  expiringIn30Days: number;
  expiringIn30DaysValue: number;
  expiringIn90Days: number;
  expiringIn90DaysValue: number;
  productsAffected: number;
}> {
  const alerts = await getExpiryAlerts(organizationId, {
    storeId,
    includeExpired: true,
  });

  const summary = {
    totalExpired: 0,
    totalExpiredValue: 0,
    expiringIn30Days: 0,
    expiringIn30DaysValue: 0,
    expiringIn90Days: 0,
    expiringIn90DaysValue: 0,
    productsAffected: new Set<string>(),
  };

  for (const alert of alerts) {
    const batch = await db.productBatches.get(alert.batchId);
    const costPrice = batch ? parseFloat(batch.costPrice) : 0;
    const value = alert.availableQuantity * costPrice;

    summary.productsAffected.add(alert.productId);

    switch (alert.status) {
      case 'expired':
        summary.totalExpired += alert.availableQuantity;
        summary.totalExpiredValue += value;
        break;
      case 'critical':
        summary.expiringIn30Days += alert.availableQuantity;
        summary.expiringIn30DaysValue += value;
        break;
      case 'warning':
        summary.expiringIn90Days += alert.availableQuantity;
        summary.expiringIn90DaysValue += value;
        break;
    }
  }

  return {
    ...summary,
    productsAffected: summary.productsAffected.size,
  };
}

// ==================== BACKGROUND TASKS ====================

// Run periodic expiry checks (call on app start and periodically)
export async function runExpiryChecks(): Promise<void> {
  console.log('[Medical] Running expiry checks...');

  // Block any expired batches
  const blocked = await blockExpiredBatches();

  // Log critical expiry alerts
  const alerts = await getExpiryAlerts(
    '', // All organizations
    { criticalDays: 7, warningDays: 30, includeExpired: false }
  );

  const criticalCount = alerts.filter((a) => a.status === 'critical').length;
  if (criticalCount > 0) {
    console.warn(`[Medical] ${criticalCount} batches expiring within 7 days!`);
  }

  console.log(`[Medical] Expiry checks complete. Blocked: ${blocked}, Critical alerts: ${criticalCount}`);
}

// Initialize medical store module
export function initMedicalStoreModule(): void {
  // Run initial checks
  runExpiryChecks();

  // Schedule periodic checks (every hour)
  setInterval(runExpiryChecks, 60 * 60 * 1000);
}
