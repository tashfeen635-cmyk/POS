import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection';
import {
  sales,
  saleItems,
  salePayments,
  products,
  imeiInventory,
  productBatches,
  customers,
  inventoryLedger,
} from '@pos/db/schema';
import type { CreateSaleInput, SaleFilterInput } from '@pos/shared';

export async function getSales(
  organizationId: string,
  storeId: string,
  filters: SaleFilterInput
) {
  const db = getDb();
  const { customerId, status, startDate, endDate, search, page, limit } = filters;

  const conditions = [
    eq(sales.organizationId, organizationId),
    eq(sales.storeId, storeId),
  ];

  if (customerId) {
    conditions.push(eq(sales.customerId, customerId));
  }

  if (status) {
    conditions.push(eq(sales.status, status));
  }

  if (startDate) {
    conditions.push(gte(sales.createdAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(sales.createdAt, new Date(endDate)));
  }

  if (search) {
    conditions.push(sql`${sales.invoiceNumber} ILIKE ${`%${search}%`}`);
  }

  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(sales)
      .where(and(...conditions))
      .orderBy(desc(sales.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
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

export async function getSaleById(organizationId: string, id: string) {
  const db = getDb();

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.organizationId, organizationId)))
    .limit(1);

  if (!sale) return null;

  const [items, payments] = await Promise.all([
    db.select().from(saleItems).where(eq(saleItems.saleId, sale.id)),
    db.select().from(salePayments).where(eq(salePayments.saleId, sale.id)),
  ]);

  return { ...sale, items, payments };
}

export async function createSale(
  organizationId: string,
  storeId: string,
  userId: string,
  input: CreateSaleInput
) {
  const db = getDb();

  // Generate invoice number
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const invoiceNumber = `INV-${dateStr}-${nanoid(6).toUpperCase()}`;

  // Calculate totals
  let subtotal = 0;
  const itemsData: Array<{
    productId: string;
    imeiId: string | null;
    batchId: string | null;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    discount: number;
    discountPercent: number;
    taxRate: number;
    taxAmount: number;
    subtotal: number;
    total: number;
    notes: string | null;
  }> = [];

  for (const item of input.items) {
    // Get product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = item.discount * item.quantity;
    const taxableAmount = itemSubtotal - itemDiscount;
    const itemTaxAmount = (taxableAmount * item.taxRate) / 100;
    const itemTotal = taxableAmount + itemTaxAmount;

    subtotal += itemTotal;

    itemsData.push({
      productId: item.productId,
      imeiId: item.imeiId || null,
      batchId: item.batchId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: parseFloat(product.costPrice),
      discount: item.discount,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      taxAmount: itemTaxAmount,
      subtotal: itemSubtotal,
      total: itemTotal,
      notes: item.notes || null,
    });
  }

  // Calculate overall discount
  const overallDiscount = input.discountPercent
    ? (subtotal * input.discountPercent) / 100
    : input.discount;
  const total = subtotal - overallDiscount;

  // Calculate payment totals
  const paidAmount = input.payments.reduce((sum, p) => sum + p.amount, 0);
  const changeAmount = Math.max(0, paidAmount - total);
  const dueAmount = Math.max(0, total - paidAmount);

  // Determine status
  let status = 'completed';
  if (dueAmount > 0) {
    status = paidAmount > 0 ? 'partially_paid' : 'pending';
  }

  // Create sale
  const [sale] = await db
    .insert(sales)
    .values({
      organizationId,
      storeId,
      invoiceNumber,
      customerId: input.customerId || null,
      userId,
      subtotal: String(subtotal),
      discount: String(overallDiscount),
      discountPercent: String(input.discountPercent || 0),
      taxAmount: String(itemsData.reduce((sum, i) => sum + i.taxAmount, 0)),
      total: String(total),
      paidAmount: String(paidAmount),
      changeAmount: String(changeAmount),
      dueAmount: String(dueAmount),
      status,
      notes: input.notes || null,
      offlineId: input.offlineId || null,
      syncedAt: input.offlineId ? new Date() : null,
    })
    .returning();

  // Create sale items
  for (const item of itemsData) {
    await db.insert(saleItems).values({
      saleId: sale.id,
      productId: item.productId,
      imeiId: item.imeiId,
      batchId: item.batchId,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      costPrice: String(item.costPrice),
      discount: String(item.discount),
      discountPercent: String(item.discountPercent),
      taxRate: String(item.taxRate),
      taxAmount: String(item.taxAmount),
      subtotal: String(item.subtotal),
      total: String(item.total),
      notes: item.notes,
    });

    // Update inventory
    if (item.imeiId) {
      // Mark IMEI as sold
      await db
        .update(imeiInventory)
        .set({
          status: 'sold',
          soldAt: new Date(),
          saleId: sale.id,
          updatedAt: new Date(),
        })
        .where(eq(imeiInventory.id, item.imeiId));
    } else if (item.batchId) {
      // Update batch sold quantity
      await db
        .update(productBatches)
        .set({
          soldQuantity: sql`${productBatches.soldQuantity} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(productBatches.id, item.batchId));
    }

    // Update product stock
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (product && product.trackInventory && !item.imeiId) {
      await db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));

      // Create inventory ledger entry
      await db.insert(inventoryLedger).values({
        organizationId,
        storeId,
        productId: item.productId,
        batchId: item.batchId,
        movementType: 'sale',
        quantity: -item.quantity,
        previousQuantity: product.stockQuantity,
        newQuantity: product.stockQuantity - item.quantity,
        reference: sale.invoiceNumber,
        referenceId: sale.id,
        userId,
      });
    }
  }

  // Create payments
  for (const payment of input.payments) {
    await db.insert(salePayments).values({
      saleId: sale.id,
      method: payment.method,
      amount: String(payment.amount),
      reference: payment.reference || null,
      tradeInId: payment.tradeInId || null,
      notes: payment.notes || null,
    });
  }

  // Update customer balance if credit sale
  if (input.customerId && dueAmount > 0) {
    await db
      .update(customers)
      .set({
        currentBalance: sql`${customers.currentBalance} + ${dueAmount}`,
        totalPurchases: sql`${customers.totalPurchases} + ${total}`,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, input.customerId));
  }

  return getSaleById(organizationId, sale.id);
}

export async function getTodaySalesSummary(organizationId: string, storeId: string) {
  const db = getDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${sales.total}::numeric), 0)::float`,
      count: sql<number>`COUNT(*)::int`,
      cash: sql<number>`COALESCE(SUM(CASE WHEN ${salePayments.method} = 'cash' THEN ${salePayments.amount}::numeric ELSE 0 END), 0)::float`,
      card: sql<number>`COALESCE(SUM(CASE WHEN ${salePayments.method} = 'card' THEN ${salePayments.amount}::numeric ELSE 0 END), 0)::float`,
      credit: sql<number>`COALESCE(SUM(${sales.dueAmount}::numeric), 0)::float`,
    })
    .from(sales)
    .leftJoin(salePayments, eq(sales.id, salePayments.saleId))
    .where(
      and(
        eq(sales.organizationId, organizationId),
        eq(sales.storeId, storeId),
        gte(sales.createdAt, today),
        lte(sales.createdAt, tomorrow)
      )
    );

  return {
    total: result[0]?.total || 0,
    count: result[0]?.count || 0,
    cash: result[0]?.cash || 0,
    card: result[0]?.card || 0,
    credit: result[0]?.credit || 0,
  };
}

export async function getRecentSales(
  organizationId: string,
  storeId: string,
  limit = 10
) {
  const db = getDb();

  return db
    .select()
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.storeId, storeId)))
    .orderBy(desc(sales.createdAt))
    .limit(limit);
}
