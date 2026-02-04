import { eq, and, or, ilike, sql, desc, asc, lt, lte, gte } from 'drizzle-orm';
import { getDb } from '../db/connection';
import {
  imeiInventory,
  productBatches,
  inventoryLedger,
  products,
} from '@pos/db/schema';
import type {
  CreateIMEIInput,
  UpdateIMEIInput,
  IMEIFilterInput,
  CreateBatchInput,
  UpdateBatchInput,
  BatchFilterInput,
  StockAdjustmentInput,
} from '@pos/shared';

// IMEI Inventory
export async function getIMEIInventory(
  organizationId: string,
  storeId: string,
  filters: IMEIFilterInput
) {
  const db = getDb();
  const { productId, status, search, page, limit } = filters;

  const conditions = [
    eq(imeiInventory.organizationId, organizationId),
    eq(imeiInventory.storeId, storeId),
  ];

  if (productId) {
    conditions.push(eq(imeiInventory.productId, productId));
  }

  if (status) {
    conditions.push(eq(imeiInventory.status, status));
  }

  if (search) {
    conditions.push(
      or(
        ilike(imeiInventory.imei1, `%${search}%`),
        ilike(imeiInventory.imei2, `%${search}%`),
        ilike(imeiInventory.serialNumber, `%${search}%`)
      )!
    );
  }

  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(imeiInventory)
      .where(and(...conditions))
      .orderBy(desc(imeiInventory.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(imeiInventory)
      .where(and(...conditions)),
  ]);

  const total = countResult[0]?.count || 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

export async function getIMEIById(organizationId: string, id: string) {
  const db = getDb();

  const [item] = await db
    .select()
    .from(imeiInventory)
    .where(and(eq(imeiInventory.id, id), eq(imeiInventory.organizationId, organizationId)))
    .limit(1);

  return item || null;
}

export async function getIMEIByNumber(organizationId: string, imei: string) {
  const db = getDb();

  const [item] = await db
    .select()
    .from(imeiInventory)
    .where(
      and(
        eq(imeiInventory.organizationId, organizationId),
        or(eq(imeiInventory.imei1, imei), eq(imeiInventory.imei2, imei))
      )
    )
    .limit(1);

  return item || null;
}

export async function createIMEI(
  organizationId: string,
  storeId: string,
  input: CreateIMEIInput
) {
  const db = getDb();

  const [item] = await db
    .insert(imeiInventory)
    .values({
      organizationId,
      storeId,
      productId: input.productId,
      imei1: input.imei1,
      imei2: input.imei2 || null,
      serialNumber: input.serialNumber || null,
      costPrice: String(input.costPrice),
      salePrice: input.salePrice ? String(input.salePrice) : null,
      color: input.color || null,
      storage: input.storage || null,
      condition: input.condition,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate).toISOString().split('T')[0] : null,
      supplierId: input.supplierId || null,
      warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry).toISOString().split('T')[0] : null,
      notes: input.notes || null,
    })
    .returning();

  return item;
}

export async function updateIMEI(
  organizationId: string,
  id: string,
  input: UpdateIMEIInput
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.costPrice !== undefined) {
    updateData.costPrice = String(input.costPrice);
  }
  if (input.salePrice !== undefined) {
    updateData.salePrice = input.salePrice ? String(input.salePrice) : null;
  }

  const [item] = await db
    .update(imeiInventory)
    .set(updateData)
    .where(and(eq(imeiInventory.id, id), eq(imeiInventory.organizationId, organizationId)))
    .returning();

  return item || null;
}

export async function getAvailableIMEIs(
  organizationId: string,
  storeId: string,
  productId: string
) {
  const db = getDb();

  return db
    .select()
    .from(imeiInventory)
    .where(
      and(
        eq(imeiInventory.organizationId, organizationId),
        eq(imeiInventory.storeId, storeId),
        eq(imeiInventory.productId, productId),
        eq(imeiInventory.status, 'in_stock')
      )
    )
    .orderBy(asc(imeiInventory.createdAt));
}

// Product Batches
export async function getBatches(
  organizationId: string,
  storeId: string,
  filters: BatchFilterInput
) {
  const db = getDb();
  const { productId, expiringSoon, expired, search, page, limit } = filters;

  const conditions = [
    eq(productBatches.organizationId, organizationId),
    eq(productBatches.storeId, storeId),
  ];

  if (productId) {
    conditions.push(eq(productBatches.productId, productId));
  }

  const today = new Date().toISOString().split('T')[0];

  if (expired) {
    conditions.push(lt(productBatches.expiryDate, today));
  } else if (expiringSoon) {
    const ninetyDaysLater = new Date();
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
    conditions.push(
      and(
        gte(productBatches.expiryDate, today),
        lte(productBatches.expiryDate, ninetyDaysLater.toISOString().split('T')[0])
      )!
    );
  }

  if (search) {
    conditions.push(ilike(productBatches.batchNumber, `%${search}%`));
  }

  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(productBatches)
      .where(and(...conditions))
      .orderBy(asc(productBatches.expiryDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productBatches)
      .where(and(...conditions)),
  ]);

  const total = countResult[0]?.count || 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

export async function createBatch(
  organizationId: string,
  storeId: string,
  input: CreateBatchInput
) {
  const db = getDb();

  const [batch] = await db
    .insert(productBatches)
    .values({
      organizationId,
      storeId,
      productId: input.productId,
      batchNumber: input.batchNumber,
      expiryDate: new Date(input.expiryDate).toISOString().split('T')[0],
      manufacturingDate: input.manufacturingDate
        ? new Date(input.manufacturingDate).toISOString().split('T')[0]
        : null,
      quantity: input.quantity,
      costPrice: String(input.costPrice),
      salePrice: input.salePrice ? String(input.salePrice) : null,
      mrp: input.mrp ? String(input.mrp) : null,
      supplierId: input.supplierId || null,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate).toISOString().split('T')[0] : null,
      notes: input.notes || null,
    })
    .returning();

  // Update product stock
  await db
    .update(products)
    .set({
      stockQuantity: sql`${products.stockQuantity} + ${input.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId));

  return batch;
}

export async function updateBatch(
  organizationId: string,
  id: string,
  input: UpdateBatchInput
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.quantity !== undefined) {
    updateData.quantity = input.quantity;
  }
  if (input.salePrice !== undefined) {
    updateData.salePrice = input.salePrice ? String(input.salePrice) : null;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  const [batch] = await db
    .update(productBatches)
    .set(updateData)
    .where(and(eq(productBatches.id, id), eq(productBatches.organizationId, organizationId)))
    .returning();

  return batch || null;
}

export async function getAvailableBatches(
  organizationId: string,
  storeId: string,
  productId: string
) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // FEFO - First Expiry First Out
  return db
    .select()
    .from(productBatches)
    .where(
      and(
        eq(productBatches.organizationId, organizationId),
        eq(productBatches.storeId, storeId),
        eq(productBatches.productId, productId),
        sql`${productBatches.quantity} - ${productBatches.soldQuantity} > 0`,
        gte(productBatches.expiryDate, today) // Not expired
      )
    )
    .orderBy(asc(productBatches.expiryDate));
}

// Stock Adjustment
export async function adjustStock(
  organizationId: string,
  storeId: string,
  userId: string,
  input: StockAdjustmentInput
) {
  const db = getDb();

  // Get current product stock
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (!product) {
    throw new Error('Product not found');
  }

  const previousQuantity = product.stockQuantity;
  const newQuantity = previousQuantity + input.quantity;

  if (newQuantity < 0) {
    throw new Error('Insufficient stock');
  }

  // Update product stock
  await db
    .update(products)
    .set({
      stockQuantity: newQuantity,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId));

  // Create ledger entry
  const [entry] = await db
    .insert(inventoryLedger)
    .values({
      organizationId,
      storeId,
      productId: input.productId,
      batchId: input.batchId || null,
      imeiId: input.imeiId || null,
      movementType: input.movementType,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reference: input.reference || null,
      reason: input.reason || null,
      userId,
    })
    .returning();

  return entry;
}

// Expiry Alerts
export async function getExpiryAlerts(organizationId: string, storeId: string, days = 90) {
  const db = getDb();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return db
    .select({
      batch: productBatches,
      product: products,
    })
    .from(productBatches)
    .innerJoin(products, eq(productBatches.productId, products.id))
    .where(
      and(
        eq(productBatches.organizationId, organizationId),
        eq(productBatches.storeId, storeId),
        sql`${productBatches.quantity} - ${productBatches.soldQuantity} > 0`,
        lte(productBatches.expiryDate, futureDate.toISOString().split('T')[0])
      )
    )
    .orderBy(asc(productBatches.expiryDate));
}
