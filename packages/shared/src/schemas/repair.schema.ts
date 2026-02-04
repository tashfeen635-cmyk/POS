import { z } from 'zod';
import { REPAIR_STATUS } from '../constants/statuses';

export const createRepairSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  customerCnic: z.string().length(13).optional().nullable(),

  // Device details
  deviceBrand: z.string().min(1, 'Device brand is required'),
  deviceModel: z.string().min(1, 'Device model is required'),
  imei: z.string().min(15).max(17).optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  password: z.string().optional().nullable(), // Device unlock code

  // Issue details
  issueDescription: z.string().min(1, 'Issue description is required'),
  accessories: z.string().optional().nullable(), // Charger, case, etc.
  deviceCondition: z.string().optional().nullable(),

  // Pricing
  estimatedCost: z.number().min(0).optional().nullable(),
  advancePayment: z.number().min(0).default(0),
  estimatedCompletionDate: z.string().datetime().optional().nullable(),

  notes: z.string().optional().nullable(),
});

export const updateRepairSchema = z.object({
  status: z.enum([
    REPAIR_STATUS.RECEIVED,
    REPAIR_STATUS.DIAGNOSING,
    REPAIR_STATUS.WAITING_PARTS,
    REPAIR_STATUS.IN_PROGRESS,
    REPAIR_STATUS.COMPLETED,
    REPAIR_STATUS.DELIVERED,
    REPAIR_STATUS.CANCELLED,
  ]).optional(),
  diagnosis: z.string().optional().nullable(),
  partsUsed: z.string().optional().nullable(),
  laborCost: z.number().min(0).optional().nullable(),
  partsCost: z.number().min(0).optional().nullable(),
  totalCost: z.number().min(0).optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const repairFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum([
    REPAIR_STATUS.RECEIVED,
    REPAIR_STATUS.DIAGNOSING,
    REPAIR_STATUS.WAITING_PARTS,
    REPAIR_STATUS.IN_PROGRESS,
    REPAIR_STATUS.COMPLETED,
    REPAIR_STATUS.DELIVERED,
    REPAIR_STATUS.CANCELLED,
  ]).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type UpdateRepairInput = z.infer<typeof updateRepairSchema>;
export type RepairFilterInput = z.infer<typeof repairFilterSchema>;
