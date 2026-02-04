import { z } from 'zod';
import { IMEI_STATUS, INVENTORY_MOVEMENT_TYPES } from '../constants/statuses';

// IMEI Inventory (Mobile)
export const createIMEISchema = z.object({
  productId: z.string().uuid(),
  imei1: z.string().min(15).max(17),
  imei2: z.string().min(15).max(17).optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0).optional(),
  color: z.string().optional().nullable(),
  storage: z.string().optional().nullable(),
  condition: z.enum(['new', 'refurbished', 'used']).default('new'),
  purchaseDate: z.string().datetime().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateIMEISchema = createIMEISchema.partial().extend({
  status: z.enum([
    IMEI_STATUS.IN_STOCK,
    IMEI_STATUS.SOLD,
    IMEI_STATUS.RETURNED,
    IMEI_STATUS.DEFECTIVE,
    IMEI_STATUS.RESERVED,
  ]).optional(),
});

export const imeiFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  status: z.enum([
    IMEI_STATUS.IN_STOCK,
    IMEI_STATUS.SOLD,
    IMEI_STATUS.RETURNED,
    IMEI_STATUS.DEFECTIVE,
    IMEI_STATUS.RESERVED,
  ]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Batch Inventory (Medical)
export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().datetime(),
  manufacturingDate: z.string().datetime().optional().nullable(),
  quantity: z.number().int().min(1),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional().nullable(), // Maximum Retail Price
  supplierId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().optional().nullable(),
});

export const updateBatchSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const batchFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  expiringSoon: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  expired: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Stock Adjustment
export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  imeiId: z.string().uuid().optional().nullable(),
  quantity: z.number().int(), // Can be negative for reduction
  movementType: z.enum([
    INVENTORY_MOVEMENT_TYPES.PURCHASE,
    INVENTORY_MOVEMENT_TYPES.SALE,
    INVENTORY_MOVEMENT_TYPES.RETURN,
    INVENTORY_MOVEMENT_TYPES.ADJUSTMENT,
    INVENTORY_MOVEMENT_TYPES.TRANSFER,
    INVENTORY_MOVEMENT_TYPES.DAMAGE,
    INVENTORY_MOVEMENT_TYPES.EXPIRED,
  ]),
  reason: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export type CreateIMEIInput = z.infer<typeof createIMEISchema>;
export type UpdateIMEIInput = z.infer<typeof updateIMEISchema>;
export type IMEIFilterInput = z.infer<typeof imeiFilterSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type BatchFilterInput = z.infer<typeof batchFilterSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
