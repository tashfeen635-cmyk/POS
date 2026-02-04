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

// Helper to convert string boolean values from query params
const stringToBoolean = (val: unknown) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (val === 'true' || val === true) return true;
  if (val === 'false' || val === false) return false;
  return undefined;
};

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  hasCredit: z.preprocess(stringToBoolean, z.boolean().optional()),
  isActive: z.preprocess(stringToBoolean, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
