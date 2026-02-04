// Re-export everything from schema
export * from './schema';

// Additional helpers
import { db, SYNC_STATUS, createSyncMetadata, generateClientId } from './schema';
import type { LocalSale, LocalSaleItem, LocalSalePayment, SyncQueueItem } from './schema';
import { nanoid } from 'nanoid';

// Generate offline sale ID
export function generateOfflineId(): string {
  return `offline_${Date.now()}_${nanoid(8)}`;
}

// Generate invoice number
export function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${dateStr}-${nanoid(6).toUpperCase()}`;
}

// Add item to sync queue with priority
export async function addToSyncQueue(
  table: string,
  operation: 'create' | 'update' | 'delete',
  recordId: string,
  data: Record<string, unknown>,
  priority: number = 5
): Promise<number> {
  const now = new Date().toISOString();

  const item: Omit<SyncQueueItem, 'id'> = {
    table,
    operation,
    recordId,
    data,
    priority,
    timestamp: now,
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: now,
    lastError: null,
    status: 'pending',
    createdAt: now,
  };

  return db.syncQueue.add(item as SyncQueueItem);
}

// Create offline sale with all denormalized data
export async function createOfflineSale(
  organizationId: string,
  storeId: string,
  userId: string,
  items: Array<{
    product: { id: string; name: string; costPrice: string; taxRate: string };
    imei?: { id: string; imei1: string } | null;
    batch?: { id: string; batchNumber: string } | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    discountPercent: number;
  }>,
  payments: Array<{
    method: string;
    amount: number;
    reference?: string | null;
    tradeInId?: string | null;
  }>,
  customerId: string | null,
  discount: number,
  discountPercent: number,
  notes: string | null
): Promise<LocalSale> {
  const offlineId = generateOfflineId();
  const invoiceNumber = generateInvoiceNumber();
  const now = new Date().toISOString();

  // Calculate totals
  let subtotal = 0;
  let taxAmount = 0;
  const saleItems: LocalSaleItem[] = [];

  for (const item of items) {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = item.discountPercent
      ? (itemSubtotal * item.discountPercent) / 100
      : item.discount * item.quantity;
    const taxableAmount = itemSubtotal - itemDiscount;
    const taxRate = parseFloat(item.product.taxRate) || 0;
    const itemTaxAmount = (taxableAmount * taxRate) / 100;
    const itemTotal = taxableAmount + itemTaxAmount;

    subtotal += taxableAmount;
    taxAmount += itemTaxAmount;

    saleItems.push({
      id: nanoid(),
      productId: item.product.id,
      productName: item.product.name,
      imeiId: item.imei?.id || null,
      imeiNumber: item.imei?.imei1 || null,
      batchId: item.batch?.id || null,
      batchNumber: item.batch?.batchNumber || null,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      costPrice: item.product.costPrice,
      discount: String(item.discount),
      discountPercent: String(item.discountPercent),
      taxRate: item.product.taxRate,
      taxAmount: String(itemTaxAmount),
      subtotal: String(itemSubtotal),
      total: String(itemTotal),
      notes: null,
    });
  }

  // Calculate overall discount
  const overallDiscount = discountPercent
    ? (subtotal * discountPercent) / 100
    : discount;
  const total = subtotal - overallDiscount + taxAmount;
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const changeAmount = Math.max(0, paidAmount - total);
  const dueAmount = Math.max(0, total - paidAmount);

  // Determine status
  let status = 'completed';
  if (dueAmount > 0) {
    status = paidAmount > 0 ? 'partially_paid' : 'pending';
  }

  const salePayments: LocalSalePayment[] = payments.map((p) => ({
    id: nanoid(),
    method: p.method,
    amount: String(p.amount),
    reference: p.reference || null,
    tradeInId: p.tradeInId || null,
    notes: null,
  }));

  const sale: LocalSale = {
    id: offlineId,
    offlineId,
    organizationId,
    storeId,
    invoiceNumber,
    customerId,
    userId,
    items: saleItems,
    payments: salePayments,
    subtotal: String(subtotal),
    discount: String(overallDiscount),
    discountPercent: String(discountPercent),
    taxAmount: String(taxAmount),
    total: String(total),
    paidAmount: String(paidAmount),
    changeAmount: String(changeAmount),
    dueAmount: String(dueAmount),
    status,
    notes,
    receiptPrinted: false,
    createdAt: now,
    updatedAt: now,
    ...createSyncMetadata(),
  };

  // Save to IndexedDB
  await db.sales.add(sale);

  // Update local inventory
  for (const item of items) {
    if (item.imei) {
      await db.imeiInventory.update(item.imei.id, {
        status: 'sold',
        soldAt: now,
        saleId: offlineId,
        _syncStatus: SYNC_STATUS.PENDING,
        _clientUpdatedAt: now,
      });
    }

    if (item.batch) {
      const batch = await db.productBatches.get(item.batch.id);
      if (batch) {
        await db.productBatches.update(item.batch.id, {
          soldQuantity: batch.soldQuantity + item.quantity,
          _syncStatus: SYNC_STATUS.PENDING,
          _clientUpdatedAt: now,
        });
      }
    }

    // Update product stock (if not IMEI tracked)
    if (!item.imei) {
      const product = await db.products.get(item.product.id);
      if (product && product.trackInventory) {
        await db.products.update(item.product.id, {
          stockQuantity: Math.max(0, product.stockQuantity - item.quantity),
          _syncStatus: SYNC_STATUS.PENDING,
          _clientUpdatedAt: now,
        });
      }
    }
  }

  // Add to sync queue with high priority (sales are critical)
  await addToSyncQueue('sales', 'create', offlineId, sale as unknown as Record<string, unknown>, 10);

  return sale;
}

// Check if product batch is expired or blocked
export async function isBatchAvailable(batchId: string): Promise<{ available: boolean; reason?: string }> {
  const batch = await db.productBatches.get(batchId);
  if (!batch) {
    return { available: false, reason: 'Batch not found' };
  }

  if (batch.isBlocked) {
    return { available: false, reason: 'Batch is blocked' };
  }

  const today = new Date();
  const expiryDate = new Date(batch.expiryDate);
  if (expiryDate < today) {
    // Auto-block expired batch
    await db.productBatches.update(batchId, { isBlocked: true });
    return { available: false, reason: 'Batch has expired' };
  }

  const availableQty = batch.quantity - batch.soldQuantity;
  if (availableQty <= 0) {
    return { available: false, reason: 'No stock available' };
  }

  return { available: true };
}

// Get IMEI warranty status
export async function getIMEIWarrantyStatus(imeiId: string): Promise<{
  hasWarranty: boolean;
  daysRemaining: number;
  expiryDate: string | null;
}> {
  const imei = await db.imeiInventory.get(imeiId);
  if (!imei || !imei.warrantyExpiry) {
    return { hasWarranty: false, daysRemaining: 0, expiryDate: null };
  }

  const today = new Date();
  const expiry = new Date(imei.warrantyExpiry);
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    hasWarranty: daysRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining),
    expiryDate: imei.warrantyExpiry,
  };
}
