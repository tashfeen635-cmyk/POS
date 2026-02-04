import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  index,
  date,
} from 'drizzle-orm/pg-core';
import { organizations, stores } from './organizations';
import { products } from './products';
import { users } from './users';

// IMEI Inventory for mobile devices
export const imeiInventory = pgTable(
  'imei_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    imei1: varchar('imei1', { length: 20 }).notNull(),
    imei2: varchar('imei2', { length: 20 }),
    serialNumber: varchar('serial_number', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull().default('in_stock'),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
    salePrice: decimal('sale_price', { precision: 12, scale: 2 }),
    color: varchar('color', { length: 50 }),
    storage: varchar('storage', { length: 50 }),
    condition: varchar('condition', { length: 50 }).notNull().default('new'),
    purchaseDate: date('purchase_date'),
    supplierId: uuid('supplier_id'),
    warrantyExpiry: date('warranty_expiry'),
    soldAt: timestamp('sold_at', { withTimezone: true }),
    saleId: uuid('sale_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('imei_inventory_organization_idx').on(table.organizationId),
    index('imei_inventory_store_idx').on(table.storeId),
    index('imei_inventory_product_idx').on(table.productId),
    index('imei_inventory_imei1_idx').on(table.imei1),
    index('imei_inventory_status_idx').on(table.status),
  ]
);

// Product Batches for medical inventory
export const productBatches = pgTable(
  'product_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    batchNumber: varchar('batch_number', { length: 100 }).notNull(),
    expiryDate: date('expiry_date').notNull(),
    manufacturingDate: date('manufacturing_date'),
    quantity: integer('quantity').notNull().default(0),
    soldQuantity: integer('sold_quantity').notNull().default(0),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(),
    salePrice: decimal('sale_price', { precision: 12, scale: 2 }),
    mrp: decimal('mrp', { precision: 12, scale: 2 }),
    supplierId: uuid('supplier_id'),
    purchaseDate: date('purchase_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('product_batches_organization_idx').on(table.organizationId),
    index('product_batches_store_idx').on(table.storeId),
    index('product_batches_product_idx').on(table.productId),
    index('product_batches_expiry_idx').on(table.expiryDate),
    index('product_batches_batch_number_idx').on(table.batchNumber),
  ]
);

// Inventory ledger for tracking all stock movements
export const inventoryLedger = pgTable(
  'inventory_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').references(() => productBatches.id, { onDelete: 'set null' }),
    imeiId: uuid('imei_id').references(() => imeiInventory.id, { onDelete: 'set null' }),
    movementType: varchar('movement_type', { length: 50 }).notNull(),
    quantity: integer('quantity').notNull(),
    previousQuantity: integer('previous_quantity').notNull(),
    newQuantity: integer('new_quantity').notNull(),
    reference: varchar('reference', { length: 100 }),
    referenceId: uuid('reference_id'),
    reason: text('reason'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('inventory_ledger_organization_idx').on(table.organizationId),
    index('inventory_ledger_product_idx').on(table.productId),
    index('inventory_ledger_date_idx').on(table.createdAt),
  ]
);
