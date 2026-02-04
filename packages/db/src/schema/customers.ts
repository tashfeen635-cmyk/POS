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
import { organizations } from './organizations';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    cnic: varchar('cnic', { length: 15 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).notNull().default('0'),
    currentBalance: decimal('current_balance', { precision: 12, scale: 2 }).notNull().default('0'),
    totalPurchases: decimal('total_purchases', { precision: 12, scale: 2 }).notNull().default('0'),
    totalPaid: decimal('total_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('customers_organization_idx').on(table.organizationId),
    index('customers_phone_idx').on(table.phone),
    index('customers_name_idx').on(table.name),
  ]
);
