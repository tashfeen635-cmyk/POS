import { z } from 'zod';
import { TRADE_IN_STATUS } from '../constants/statuses';

export const createTradeInSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().optional().nullable(), // For walk-in customers
  customerPhone: z.string().optional().nullable(),
  customerCnic: z.string().length(13).optional().nullable(),

  // Device details
  deviceBrand: z.string().min(1, 'Device brand is required'),
  deviceModel: z.string().min(1, 'Device model is required'),
  imei: z.string().min(15).max(17).optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  storage: z.string().optional().nullable(),
  color: z.string().optional().nullable(),

  // Condition assessment
  condition: z.enum(['excellent', 'good', 'fair', 'poor']),
  conditionNotes: z.string().optional().nullable(),
  hasOriginalBox: z.boolean().default(false),
  hasCharger: z.boolean().default(false),
  hasAccessories: z.boolean().default(false),

  // Pricing
  estimatedValue: z.number().min(0),
  offeredPrice: z.number().min(0),
  agreedPrice: z.number().min(0).optional().nullable(),

  notes: z.string().optional().nullable(),
});

export const updateTradeInSchema = createTradeInSchema.partial().extend({
  status: z.enum([
    TRADE_IN_STATUS.PENDING,
    TRADE_IN_STATUS.ACCEPTED,
    TRADE_IN_STATUS.REJECTED,
    TRADE_IN_STATUS.COMPLETED,
  ]).optional(),
  agreedPrice: z.number().min(0).optional().nullable(),
  saleId: z.string().uuid().optional().nullable(), // Link to sale when used
});

export const tradeInFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum([
    TRADE_IN_STATUS.PENDING,
    TRADE_IN_STATUS.ACCEPTED,
    TRADE_IN_STATUS.REJECTED,
    TRADE_IN_STATUS.COMPLETED,
  ]).optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateTradeInInput = z.infer<typeof createTradeInSchema>;
export type UpdateTradeInInput = z.infer<typeof updateTradeInSchema>;
export type TradeInFilterInput = z.infer<typeof tradeInFilterSchema>;
