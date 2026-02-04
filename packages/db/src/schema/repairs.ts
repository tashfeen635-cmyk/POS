import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  index,
  date,
} from 'drizzle-orm/pg-core';
import { organizations, stores } from './organizations';
import { users } from './users';
import { customers } from './customers';

export const repairOrders = pgTable(
  'repair_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    ticketNumber: varchar('ticket_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Customer details
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 50 }).notNull(),
    customerCnic: varchar('customer_cnic', { length: 15 }),

    // Device details
    deviceBrand: varchar('device_brand', { length: 100 }).notNull(),
    deviceModel: varchar('device_model', { length: 100 }).notNull(),
    imei: varchar('imei', { length: 20 }),
    serialNumber: varchar('serial_number', { length: 100 }),
    password: varchar('password', { length: 100 }),

    // Issue
    issueDescription: text('issue_description').notNull(),
    accessories: text('accessories'),
    deviceCondition: text('device_condition'),

    // Diagnosis & Repair
    diagnosis: text('diagnosis'),
    partsUsed: text('parts_used'),

    // Pricing
    estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
    laborCost: decimal('labor_cost', { precision: 12, scale: 2 }),
    partsCost: decimal('parts_cost', { precision: 12, scale: 2 }),
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
    advancePayment: decimal('advance_payment', { precision: 12, scale: 2 }).notNull().default('0'),
    balanceDue: decimal('balance_due', { precision: 12, scale: 2 }).notNull().default('0'),

    // Dates
    estimatedCompletionDate: date('estimated_completion_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    status: varchar('status', { length: 50 }).notNull().default('received'),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('repair_orders_organization_idx').on(table.organizationId),
    index('repair_orders_store_idx').on(table.storeId),
    index('repair_orders_customer_idx').on(table.customerId),
    index('repair_orders_ticket_idx').on(table.ticketNumber),
    index('repair_orders_status_idx').on(table.status),
    index('repair_orders_date_idx').on(table.createdAt),
  ]
);
