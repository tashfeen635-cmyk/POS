import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  cnic: z.string().length(13, 'CNIC must be 13 digits').optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  creditLimit: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  hasCredit: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
