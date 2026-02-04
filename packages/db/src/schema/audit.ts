import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations, stores } from './organizations';
import { users } from './users';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    tableName: varchar('table_name', { length: 100 }).notNull(),
    recordId: uuid('record_id'),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_organization_idx').on(table.organizationId),
    index('audit_logs_user_idx').on(table.userId),
    index('audit_logs_table_idx').on(table.tableName),
    index('audit_logs_date_idx').on(table.createdAt),
  ]
);

export const syncLogs = pgTable(
  'sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    syncType: varchar('sync_type', { length: 50 }).notNull(), // 'push', 'pull', 'full'
    tablesAffected: jsonb('tables_affected'),
    recordsCreated: jsonb('records_created'),
    recordsUpdated: jsonb('records_updated'),
    conflicts: jsonb('conflicts'),
    status: varchar('status', { length: 50 }).notNull(), // 'success', 'partial', 'failed'
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_logs_organization_idx').on(table.organizationId),
    index('sync_logs_store_idx').on(table.storeId),
    index('sync_logs_date_idx').on(table.createdAt),
  ]
);
