import { eq, and, gt, sql, or } from 'drizzle-orm';
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
  inventoryLedger,
} from '@pos/db/schema';
import type { SyncRequestInput, CreateSaleInput } from '@pos/shared';
import * as saleService from './sale.service';

interface SyncChange {
  table: string;
  operation: 'create' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  serverTimestamp: string;
}

interface PaginationOptions {
  limit: number;
  cursor?: string;
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
            // Check if sale already exists (by offlineId for idempotency)
            const [existing] = await db
              .select()
              .from(sales)
              .where(eq(sales.offlineId, id))
              .limit(1);

            if (!existing) {
              // Create the sale using the sale service
              try {
                const saleInput = data as unknown as CreateSaleInput;
                saleInput.offlineId = id; // Ensure offlineId is set

                await saleService.createSale(organizationId, storeId, userId, saleInput);
                recordsCreated[table] = (recordsCreated[table] || 0) + 1;
              } catch (error) {
                // Log but don't fail the entire sync
                console.error(`Failed to create sale ${id}:`, error);
                conflicts.push({
                  table,
                  id,
                  clientData: data as Record<string, unknown>,
                  serverData: {},
                  resolution: 'manual',
                });
              }
            }
          }
          break;

        case 'customers':
          if (operation === 'create' && data) {
            // Check for duplicate
            const [existing] = await db
              .select()
              .from(customers)
              .where(
                and(
                  eq(customers.organizationId, organizationId),
                  or(
                    eq(customers.id, id),
                    data.phone ? eq(customers.phone, data.phone as string) : sql`false`
                  )
                )
              )
              .limit(1);

            if (!existing) {
              await db.insert(customers).values({
                id,
                organizationId,
                name: data.name as string,
                phone: (data.phone as string) || null,
                email: (data.email as string) || null,
                address: (data.address as string) || null,
                notes: (data.notes as string) || null,
              });
              recordsCreated[table] = (recordsCreated[table] || 0) + 1;
            }
          } else if (operation === 'update' && data) {
            const [existing] = await db
              .select()
              .from(customers)
              .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
              .limit(1);

            if (existing) {
              // Check for conflict (server modified since client last synced)
              const clientTimestamp = data.updatedAt ? new Date(data.updatedAt as string) : new Date(0);
              if (existing.updatedAt > clientTimestamp) {
                // Conflict - server wins for customers
                conflicts.push({
                  table,
                  id,
                  clientData: data as Record<string, unknown>,
                  serverData: existing as unknown as Record<string, unknown>,
                  resolution: 'server_wins',
                });
              } else {
                await db
                  .update(customers)
                  .set({
                    name: (data.name as string) || existing.name,
                    phone: (data.phone as string) || existing.phone,
                    email: (data.email as string) || existing.email,
                    address: (data.address as string) || existing.address,
                    notes: (data.notes as string) || existing.notes,
                    updatedAt: new Date(),
                  })
                  .where(eq(customers.id, id));
                recordsUpdated[table] = (recordsUpdated[table] || 0) + 1;
              }
            }
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
  since: string | null,
  options: PaginationOptions = { limit: 500 }
) {
  const db = getDb();
  const lastSyncedAt = since ? new Date(since) : new Date(0);
  const changes: SyncChange[] = [];
  let nextCursor: string | undefined;

  // Get updated products
  const updatedProducts = await db
    .select()
    .from(products)
    .where(
      and(eq(products.organizationId, organizationId), gt(products.updatedAt, lastSyncedAt))
    )
    .limit(options.limit);

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
    )
    .limit(options.limit);

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
    )
    .limit(options.limit);

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
    )
    .limit(options.limit);

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
    )
    .limit(options.limit);

  for (const batch of updatedBatches) {
    changes.push({
      table: 'product_batches',
      operation: 'update',
      id: batch.id,
      data: batch as Record<string, unknown>,
      serverTimestamp: batch.updatedAt.toISOString(),
    });
  }

  // Check if we hit the limit (pagination needed)
  const totalChanges = changes.length;
  if (totalChanges >= options.limit) {
    // Set cursor to the last timestamp for pagination
    const lastChange = changes[changes.length - 1];
    nextCursor = lastChange?.serverTimestamp;
  }

  return {
    serverTimestamp: new Date().toISOString(),
    changes,
    hasMore: !!nextCursor,
    nextCursor,
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
  const db = getDb();
  const processed: Array<{ clientId: string; serverId?: string; error?: string }> = [];
  const conflicts: Array<{
    clientId: string;
    clientData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolution: 'client_wins' | 'server_wins' | 'manual';
  }> = [];

  for (const item of items) {
    try {
      switch (table) {
        case 'sales': {
          if (item.operation === 'create' && item.data) {
            // Check for duplicate by offlineId (idempotency)
            const [existing] = await db
              .select({ id: sales.id })
              .from(sales)
              .where(eq(sales.offlineId, item.clientId))
              .limit(1);

            if (existing) {
              // Already processed, return existing ID
              processed.push({
                clientId: item.clientId,
                serverId: existing.id,
              });
            } else {
              // Create the sale
              const saleInput = item.data as unknown as CreateSaleInput;
              saleInput.offlineId = item.clientId;

              const sale = await saleService.createSale(organizationId, storeId, userId, saleInput);
              processed.push({
                clientId: item.clientId,
                serverId: sale?.id,
              });
            }
          } else {
            processed.push({
              clientId: item.clientId,
              error: `Operation ${item.operation} not supported for sales`,
            });
          }
          break;
        }

        case 'customers': {
          if (item.operation === 'create' && item.data) {
            // Check for duplicate
            const [existing] = await db
              .select()
              .from(customers)
              .where(
                and(
                  eq(customers.organizationId, organizationId),
                  or(
                    eq(customers.id, item.clientId),
                    item.data.phone ? eq(customers.phone, item.data.phone as string) : sql`false`
                  )
                )
              )
              .limit(1);

            if (existing) {
              // Already exists - might be a conflict
              if (existing.id !== item.clientId) {
                conflicts.push({
                  clientId: item.clientId,
                  clientData: item.data,
                  serverData: existing as unknown as Record<string, unknown>,
                  resolution: 'server_wins',
                });
              }
              processed.push({
                clientId: item.clientId,
                serverId: existing.id,
              });
            } else {
              const [created] = await db
                .insert(customers)
                .values({
                  id: item.clientId,
                  organizationId,
                  name: item.data.name as string,
                  phone: (item.data.phone as string) || null,
                  email: (item.data.email as string) || null,
                  address: (item.data.address as string) || null,
                  notes: (item.data.notes as string) || null,
                })
                .returning({ id: customers.id });

              processed.push({
                clientId: item.clientId,
                serverId: created.id,
              });
            }
          } else if (item.operation === 'update' && item.data) {
            const [existing] = await db
              .select()
              .from(customers)
              .where(and(eq(customers.id, item.clientId), eq(customers.organizationId, organizationId)))
              .limit(1);

            if (existing) {
              // Check for conflict
              const clientTimestamp = new Date(item.timestamp);
              if (existing.updatedAt > clientTimestamp) {
                conflicts.push({
                  clientId: item.clientId,
                  clientData: item.data,
                  serverData: existing as unknown as Record<string, unknown>,
                  resolution: 'server_wins',
                });
                processed.push({
                  clientId: item.clientId,
                  serverId: existing.id,
                });
              } else {
                await db
                  .update(customers)
                  .set({
                    name: (item.data.name as string) || existing.name,
                    phone: (item.data.phone as string) || existing.phone,
                    email: (item.data.email as string) || existing.email,
                    address: (item.data.address as string) || existing.address,
                    notes: (item.data.notes as string) || existing.notes,
                    updatedAt: new Date(),
                  })
                  .where(eq(customers.id, item.clientId));

                processed.push({
                  clientId: item.clientId,
                  serverId: item.clientId,
                });
              }
            } else {
              processed.push({
                clientId: item.clientId,
                error: 'Customer not found',
              });
            }
          } else {
            processed.push({
              clientId: item.clientId,
              error: `Operation ${item.operation} not supported`,
            });
          }
          break;
        }

        default:
          processed.push({
            clientId: item.clientId,
            error: `Table ${table} not supported for sync`,
          });
      }
    } catch (error) {
      processed.push({
        clientId: item.clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: processed.every((p) => !p.error),
    processed,
    conflicts,
  };
}
