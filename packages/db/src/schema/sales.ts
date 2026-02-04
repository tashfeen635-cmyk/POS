import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, stores } from './organizations';
import { users } from './users';
import { customers } from './customers';
import { products } from './products';
import { imeiInventory, productBatches } from './inventory';

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Amounts
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
    discount: decimal('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    total: decimal('total', { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    changeAmount: decimal('change_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    dueAmount: decimal('due_amount', { precision: 12, scale: 2 }).notNull().default('0'),

    status: varchar('status', { length: 50 }).notNull().default('completed'),
    notes: text('notes'),

    // Offline support
    offlineId: varchar('offline_id', { length: 100 }),
    syncedAt: timestamp('synced_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sales_organization_idx').on(table.organizationId),
    index('sales_store_idx').on(table.storeId),
    index('sales_customer_idx').on(table.customerId),
    index('sales_invoice_idx').on(table.invoiceNumber),
    index('sales_date_idx').on(table.createdAt),
    index('sales_status_idx').on(table.status),
    index('sales_offline_id_idx').on(table.offlineId),
  ]
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    imeiId: uuid('imei_id').references(() => imeiInventory.id),
    batchId: uuid('batch_id').references(() => productBatches.id),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
    discount: decimal('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
    taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
    total: decimal('total', { precision: 12, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sale_items_sale_idx').on(table.saleId),
    index('sale_items_product_idx').on(table.productId),
  ]
);

export const salePayments = pgTable(
  'sale_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 50 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    reference: varchar('reference', { length: 255 }),
    tradeInId: uuid('trade_in_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sale_payments_sale_idx').on(table.saleId)]
);

export const saleReturns = pgTable(
  'sale_returns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    totalRefund: decimal('total_refund', { precision: 12, scale: 2 }).notNull(),
    refundMethod: varchar('refund_method', { length: 50 }).notNull(),
    reason: text('reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sale_returns_sale_idx').on(table.saleId)]
);

export const saleReturnItems = pgTable(
  'sale_return_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => saleReturns.id, { onDelete: 'cascade' }),
    saleItemId: uuid('sale_item_id')
      .notNull()
      .references(() => saleItems.id),
    quantity: integer('quantity').notNull(),
    refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason'),
  },
  (table) => [index('sale_return_items_return_idx').on(table.returnId)]
);
