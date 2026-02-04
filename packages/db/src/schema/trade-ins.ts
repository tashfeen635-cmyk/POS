import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, stores } from './organizations';
import { users } from './users';
import { customers } from './customers';
import { sales } from './sales';

export const tradeIns = pgTable(
  'trade_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Customer details (for walk-ins)
    customerName: varchar('customer_name', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 50 }),
    customerCnic: varchar('customer_cnic', { length: 15 }),

    // Device details
    deviceBrand: varchar('device_brand', { length: 100 }).notNull(),
    deviceModel: varchar('device_model', { length: 100 }).notNull(),
    imei: varchar('imei', { length: 20 }),
    serialNumber: varchar('serial_number', { length: 100 }),
    storage: varchar('storage', { length: 50 }),
    color: varchar('color', { length: 50 }),

    // Condition
    condition: varchar('condition', { length: 50 }).notNull(),
    conditionNotes: text('condition_notes'),
    hasOriginalBox: boolean('has_original_box').notNull().default(false),
    hasCharger: boolean('has_charger').notNull().default(false),
    hasAccessories: boolean('has_accessories').notNull().default(false),

    // Pricing
    estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }).notNull(),
    offeredPrice: decimal('offered_price', { precision: 12, scale: 2 }).notNull(),
    agreedPrice: decimal('agreed_price', { precision: 12, scale: 2 }),

    status: varchar('status', { length: 50 }).notNull().default('pending'),
    saleId: uuid('sale_id').references(() => sales.id, { onDelete: 'set null' }),

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('trade_ins_organization_idx').on(table.organizationId),
    index('trade_ins_store_idx').on(table.storeId),
    index('trade_ins_customer_idx').on(table.customerId),
    index('trade_ins_status_idx').on(table.status),
    index('trade_ins_date_idx').on(table.createdAt),
  ]
);
