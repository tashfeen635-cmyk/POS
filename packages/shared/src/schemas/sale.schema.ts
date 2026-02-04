import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants/payment-methods';
import { SALE_STATUS } from '../constants/statuses';

// Sale Item
export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  imeiId: z.string().uuid().optional().nullable(), // For IMEI tracked items
  batchId: z.string().uuid().optional().nullable(), // For batch tracked items
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0), // Discount amount per unit
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
});

// Payment
export const salePaymentSchema = z.object({
  method: z.enum([
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.CARD,
    PAYMENT_METHODS.UPI,
    PAYMENT_METHODS.BANK_TRANSFER,
    PAYMENT_METHODS.CREDIT,
    PAYMENT_METHODS.TRADE_IN,
  ]),
  amount: z.number().min(0),
  reference: z.string().optional().nullable(), // Card last 4, UPI ref, etc.
  tradeInId: z.string().uuid().optional().nullable(), // For trade-in payments
  notes: z.string().optional().nullable(),
});

// Create Sale
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  payments: z.array(salePaymentSchema).min(1, 'At least one payment is required'),
  discount: z.number().min(0).default(0), // Overall sale discount
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
  offlineId: z.string().optional(), // For sync purposes
});

// Update Sale (limited fields)
export const updateSaleSchema = z.object({
  notes: z.string().optional().nullable(),
  status: z.enum([
    SALE_STATUS.PENDING,
    SALE_STATUS.COMPLETED,
    SALE_STATUS.PARTIALLY_PAID,
    SALE_STATUS.REFUNDED,
    SALE_STATUS.CANCELLED,
  ]).optional(),
});

// Add Payment to existing sale
export const addPaymentSchema = salePaymentSchema;

// Sale filter
export const saleFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum([
    SALE_STATUS.PENDING,
    SALE_STATUS.COMPLETED,
    SALE_STATUS.PARTIALLY_PAID,
    SALE_STATUS.REFUNDED,
    SALE_STATUS.CANCELLED,
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(), // Invoice number
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Return / Refund
export const saleReturnSchema = z.object({
  saleId: z.string().uuid(),
  items: z.array(z.object({
    saleItemId: z.string().uuid(),
    quantity: z.number().int().min(1),
    reason: z.string().optional().nullable(),
  })),
  refundMethod: z.enum([
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.CARD,
    PAYMENT_METHODS.UPI,
    PAYMENT_METHODS.BANK_TRANSFER,
    PAYMENT_METHODS.CREDIT,
  ]),
  notes: z.string().optional().nullable(),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type SaleFilterInput = z.infer<typeof saleFilterSchema>;
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;
