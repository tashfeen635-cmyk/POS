import { z } from 'zod';
import { SYNC_STATUS } from '../constants/statuses';

// Sync request from client
export const syncRequestSchema = z.object({
  lastSyncedAt: z.string().datetime().optional().nullable(),
  changes: z.array(z.object({
    table: z.string(),
    operation: z.enum(['create', 'update', 'delete']),
    id: z.string(),
    data: z.record(z.unknown()).optional(),
    clientTimestamp: z.string().datetime(),
  })),
});

// Sync response to client
export const syncResponseSchema = z.object({
  serverTimestamp: z.string().datetime(),
  changes: z.array(z.object({
    table: z.string(),
    operation: z.enum(['create', 'update', 'delete']),
    id: z.string(),
    data: z.record(z.unknown()).optional(),
    serverTimestamp: z.string().datetime(),
  })),
  conflicts: z.array(z.object({
    table: z.string(),
    id: z.string(),
    clientData: z.record(z.unknown()),
    serverData: z.record(z.unknown()),
    resolution: z.enum(['client_wins', 'server_wins', 'manual']),
  })),
});

// Local sync metadata schema
export const syncMetadataSchema = z.object({
  _syncStatus: z.enum([
    SYNC_STATUS.SYNCED,
    SYNC_STATUS.PENDING,
    SYNC_STATUS.FAILED,
    SYNC_STATUS.CONFLICT,
  ]),
  _clientId: z.string(),
  _clientCreatedAt: z.string().datetime(),
  _clientUpdatedAt: z.string().datetime(),
  _serverSyncedAt: z.string().datetime().optional().nullable(),
  _syncAttempts: z.number().int().min(0).default(0),
  _lastSyncError: z.string().optional().nullable(),
});

export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
export type SyncResponseInput = z.infer<typeof syncResponseSchema>;
export type SyncMetadata = z.infer<typeof syncMetadataSchema>;
