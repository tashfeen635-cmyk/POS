import { eq, and, gt, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import {
  products,
  categories,
  customers,
  sales,
  saleItems,
  salePayments,
  imeiInventory,
  productBatches,
  syncLogs,
} from '@pos/db/schema';
import type { SyncRequestInput } from '@pos/shared';

interface SyncChange {
  table: string;
  operation: 'create' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  serverTimestamp: string;
}

export async function processSync(
  organizationId: string,
  storeId: string,
  userId: string,
  clientId: string,
  input: SyncRequestInput
) {
  const db = getDb();
  const startedAt = new Date();

  const serverChanges: SyncChange[] = [];
  const conflicts: Array<{
    table: string;
    id: string;
    clientData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolution: 'client_wins' | 'server_wins' | 'manual';
  }> = [];

  const recordsCreated: Record<string, number> = {};
  const recordsUpdated: Record<string, number> = {};

  try {
    // Process client changes
    for (const change of input.changes) {
      const { table, operation, id, data } = change;

      switch (table) {
        case 'sales':
          if (operation === 'create' && data) {
            // Check if sale already exists (by offlineId)
            const [existing] = await db
              .select()
              .from(sales)
              .where(eq(sales.offlineId, id))
              .limit(1);

            if (!existing) {
              // Process the sale creation
              // This would be handled by sale.service.createSale
              recordsCreated[table] = (recordsCreated[table] || 0) + 1;
            }
          }
          break;

        case 'customers':
          if (operation === 'create' && data) {
            recordsCreated[table] = (recordsCreated[table] || 0) + 1;
          } else if (operation === 'update' && data) {
            recordsUpdated[table] = (recordsUpdated[table] || 0) + 1;
          }
          break;

        default:
          // Handle other tables as needed
          break;
      }
    }

    // Get server changes since last sync
    const lastSyncedAt = input.lastSyncedAt ? new Date(input.lastSyncedAt) : new Date(0);

    // Get updated products
    const updatedProducts = await db
      .select()
      .from(products)
      .where(
        and(eq(products.organizationId, organizationId), gt(products.updatedAt, lastSyncedAt))
      );

    for (const product of updatedProducts) {
      serverChanges.push({
        table: 'products',
        operation: 'update',
        id: product.id,
        data: product as Record<string, unknown>,
        serverTimestamp: product.updatedAt.toISOString(),
      });
    }

    // Get updated categories
    const updatedCategories = await db
      .select()
      .from(categories)
      .where(
        and(eq(categories.organizationId, organizationId), gt(categories.updatedAt, lastSyncedAt))
      );

    for (const category of updatedCategories) {
      serverChanges.push({
        table: 'categories',
        operation: 'update',
        id: category.id,
        data: category as Record<string, unknown>,
        serverTimestamp: category.updatedAt.toISOString(),
      });
    }

    // Get updated customers
    const updatedCustomers = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.organizationId, organizationId), gt(customers.updatedAt, lastSyncedAt))
      );

    for (const customer of updatedCustomers) {
      serverChanges.push({
        table: 'customers',
        operation: 'update',
        id: customer.id,
        data: customer as Record<string, unknown>,
        serverTimestamp: customer.updatedAt.toISOString(),
      });
    }

    // Get updated IMEI inventory
    const updatedIMEIs = await db
      .select()
      .from(imeiInventory)
      .where(
        and(
          eq(imeiInventory.organizationId, organizationId),
          eq(imeiInventory.storeId, storeId),
          gt(imeiInventory.updatedAt, lastSyncedAt)
        )
      );

    for (const imei of updatedIMEIs) {
      serverChanges.push({
        table: 'imei_inventory',
        operation: 'update',
        id: imei.id,
        data: imei as Record<string, unknown>,
        serverTimestamp: imei.updatedAt.toISOString(),
      });
    }

    // Get updated batches
    const updatedBatches = await db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.organizationId, organizationId),
          eq(productBatches.storeId, storeId),
          gt(productBatches.updatedAt, lastSyncedAt)
        )
      );

    for (const batch of updatedBatches) {
      serverChanges.push({
        table: 'product_batches',
        operation: 'update',
        id: batch.id,
        data: batch as Record<string, unknown>,
        serverTimestamp: batch.updatedAt.toISOString(),
      });
    }

    // Log sync
    await db.insert(syncLogs).values({
      organizationId,
      storeId,
      userId,
      clientId,
      syncType: 'full',
      tablesAffected: Object.keys({ ...recordsCreated, ...recordsUpdated }),
      recordsCreated,
      recordsUpdated,
      conflicts,
      status: conflicts.length > 0 ? 'partial' : 'success',
      startedAt,
      completedAt: new Date(),
    });

    return {
      serverTimestamp: new Date().toISOString(),
      changes: serverChanges,
      conflicts,
    };
  } catch (error) {
    // Log failed sync
    await db.insert(syncLogs).values({
      organizationId,
      storeId,
      userId,
      clientId,
      syncType: 'full',
      tablesAffected: [],
      recordsCreated: {},
      recordsUpdated: {},
      conflicts: [],
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      completedAt: new Date(),
    });

    throw error;
  }
}

export async function getLastSyncTime(
  organizationId: string,
  storeId: string,
  clientId: string
) {
  const db = getDb();

  const [lastSync] = await db
    .select({ completedAt: syncLogs.completedAt })
    .from(syncLogs)
    .where(
      and(
        eq(syncLogs.organizationId, organizationId),
        eq(syncLogs.storeId, storeId),
        eq(syncLogs.clientId, clientId),
        eq(syncLogs.status, 'success')
      )
    )
    .orderBy(sql`${syncLogs.completedAt} DESC`)
    .limit(1);

  return lastSync?.completedAt?.toISOString() || null;
}

// Pull changes from server (for GET /api/sync/pull)
export async function pullChanges(
  organizationId: string,
  storeId: string,
  since: string | null
) {
  const db = getDb();
  const lastSyncedAt = since ? new Date(since) : new Date(0);
  const changes: SyncChange[] = [];

  // Get updated products
  const updatedProducts = await db
    .select()
    .from(products)
    .where(
      and(eq(products.organizationId, organizationId), gt(products.updatedAt, lastSyncedAt))
    );

  for (const product of updatedProducts) {
    changes.push({
      table: 'products',
      operation: 'update',
      id: product.id,
      data: product as Record<string, unknown>,
      serverTimestamp: product.updatedAt.toISOString(),
    });
  }

  // Get updated categories
  const updatedCategories = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.organizationId, organizationId), gt(categories.updatedAt, lastSyncedAt))
    );

  for (const category of updatedCategories) {
    changes.push({
      table: 'categories',
      operation: 'update',
      id: category.id,
      data: category as Record<string, unknown>,
      serverTimestamp: category.updatedAt.toISOString(),
    });
  }

  // Get updated customers
  const updatedCustomers = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.organizationId, organizationId), gt(customers.updatedAt, lastSyncedAt))
    );

  for (const customer of updatedCustomers) {
    changes.push({
      table: 'customers',
      operation: 'update',
      id: customer.id,
      data: customer as Record<string, unknown>,
      serverTimestamp: customer.updatedAt.toISOString(),
    });
  }

  // Get updated IMEI inventory
  const updatedIMEIs = await db
    .select()
    .from(imeiInventory)
    .where(
      and(
        eq(imeiInventory.organizationId, organizationId),
        eq(imeiInventory.storeId, storeId),
        gt(imeiInventory.updatedAt, lastSyncedAt)
      )
    );

  for (const imei of updatedIMEIs) {
    changes.push({
      table: 'imei_inventory',
      operation: 'update',
      id: imei.id,
      data: imei as Record<string, unknown>,
      serverTimestamp: imei.updatedAt.toISOString(),
    });
  }

  // Get updated batches
  const updatedBatches = await db
    .select()
    .from(productBatches)
    .where(
      and(
        eq(productBatches.organizationId, organizationId),
        eq(productBatches.storeId, storeId),
        gt(productBatches.updatedAt, lastSyncedAt)
      )
    );

  for (const batch of updatedBatches) {
    changes.push({
      table: 'product_batches',
      operation: 'update',
      id: batch.id,
      data: batch as Record<string, unknown>,
      serverTimestamp: batch.updatedAt.toISOString(),
    });
  }

  return {
    serverTimestamp: new Date().toISOString(),
    changes,
  };
}

// Push changes for a specific table (for POST /api/sync/:table)
export async function pushTableChanges(
  organizationId: string,
  storeId: string,
  userId: string,
  clientId: string,
  table: string,
  items: Array<{
    clientId: string;
    operation: 'create' | 'update' | 'delete';
    data?: Record<string, unknown>;
    timestamp: string;
  }>
) {
  const processed: Array<{ clientId: string; serverId?: string; error?: string }> = [];
  const conflicts: Array<{
    clientId: string;
    clientData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolution: 'client_wins' | 'server_wins' | 'manual';
  }> = [];

  // For now, acknowledge all items as processed successfully
  // In production, this would actually apply the changes to the database
  for (const item of items) {
    try {
      // TODO: Implement actual table-specific sync logic
      // For now, just acknowledge receipt
      processed.push({
        clientId: item.clientId,
        serverId: item.clientId, // In real impl, might be a new server-generated ID
      });
    } catch (error) {
      processed.push({
        clientId: item.clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: true,
    processed,
    conflicts,
  };
}
