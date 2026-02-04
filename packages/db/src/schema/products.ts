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
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    parentId: uuid('parent_id'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categories_organization_idx').on(table.organizationId),
    index('categories_parent_idx').on(table.parentId),
  ]
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 100 }),
    barcode: varchar('barcode', { length: 100 }),
    productType: varchar('product_type', { length: 50 }).notNull().default('general'),

    // Pricing
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull().default('0'),
    salePrice: decimal('sale_price', { precision: 12, scale: 2 }).notNull().default('0'),
    wholesalePrice: decimal('wholesale_price', { precision: 12, scale: 2 }),
    minSalePrice: decimal('min_sale_price', { precision: 12, scale: 2 }),

    // Stock
    stockQuantity: integer('stock_quantity').notNull().default(0),
    minStockLevel: integer('min_stock_level').notNull().default(5),
    maxStockLevel: integer('max_stock_level'),
    unit: varchar('unit', { length: 50 }).notNull().default('pcs'),

    // Mobile specific
    brand: varchar('brand', { length: 100 }),
    model: varchar('model', { length: 100 }),
    color: varchar('color', { length: 50 }),
    storage: varchar('storage', { length: 50 }),
    ram: varchar('ram', { length: 50 }),
    warrantyDays: integer('warranty_days'),

    // Medical specific
    genericName: varchar('generic_name', { length: 255 }),
    manufacturer: varchar('manufacturer', { length: 255 }),
    schedule: varchar('schedule', { length: 50 }),
    dosageForm: varchar('dosage_form', { length: 50 }),
    strength: varchar('strength', { length: 100 }),
    packSize: integer('pack_size'),
    unitsPerPack: integer('units_per_pack'),
    requiresPrescription: boolean('requires_prescription').notNull().default(false),

    // Flags
    isActive: boolean('is_active').notNull().default(true),
    trackInventory: boolean('track_inventory').notNull().default(true),
    allowDiscount: boolean('allow_discount').notNull().default(true),
    taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),

    description: text('description'),
    notes: text('notes'),
    imageUrl: text('image_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('products_organization_idx').on(table.organizationId),
    index('products_category_idx').on(table.categoryId),
    index('products_sku_idx').on(table.sku),
    index('products_barcode_idx').on(table.barcode),
    index('products_name_idx').on(table.name),
    index('products_type_idx').on(table.productType),
  ]
);
