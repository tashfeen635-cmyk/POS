import { z } from 'zod';
import {
  PRODUCT_TYPES,
  MEDICINE_SCHEDULES,
  DOSAGE_FORMS,
} from '../constants/product-types';

const productTypeEnum = z.enum([
  PRODUCT_TYPES.GENERAL,
  PRODUCT_TYPES.MOBILE_DEVICE,
  PRODUCT_TYPES.ACCESSORY,
  PRODUCT_TYPES.SPARE_PART,
  PRODUCT_TYPES.MEDICINE,
  PRODUCT_TYPES.MEDICAL_DEVICE,
  PRODUCT_TYPES.CONSUMABLE,
]);

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  productType: productTypeEnum.default('general'),

  // Pricing
  costPrice: z.number().min(0, 'Cost price must be positive'),
  salePrice: z.number().min(0, 'Sale price must be positive'),
  wholesalePrice: z.number().min(0).optional().nullable(),
  minSalePrice: z.number().min(0).optional().nullable(),

  // Stock
  stockQuantity: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(5),
  maxStockLevel: z.number().int().min(0).optional().nullable(),
  unit: z.string().default('pcs'),

  // Mobile specific
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  storage: z.string().optional().nullable(),
  ram: z.string().optional().nullable(),
  warrantyDays: z.number().int().min(0).optional().nullable(),

  // Medical specific
  genericName: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  schedule: z.enum([
    MEDICINE_SCHEDULES.OTC,
    MEDICINE_SCHEDULES.SCHEDULE_G,
    MEDICINE_SCHEDULES.SCHEDULE_H,
    MEDICINE_SCHEDULES.NARCOTIC,
  ]).optional().nullable(),
  dosageForm: z.enum([
    DOSAGE_FORMS.TABLET,
    DOSAGE_FORMS.CAPSULE,
    DOSAGE_FORMS.SYRUP,
    DOSAGE_FORMS.INJECTION,
    DOSAGE_FORMS.CREAM,
    DOSAGE_FORMS.OINTMENT,
    DOSAGE_FORMS.DROPS,
    DOSAGE_FORMS.INHALER,
    DOSAGE_FORMS.POWDER,
    DOSAGE_FORMS.GEL,
    DOSAGE_FORMS.SUSPENSION,
    DOSAGE_FORMS.OTHER,
  ]).optional().nullable(),
  strength: z.string().optional().nullable(),
  packSize: z.number().int().min(1).optional().nullable(), // e.g., 10 tablets per strip
  unitsPerPack: z.number().int().min(1).optional().nullable(), // e.g., 3 strips per pack
  requiresPrescription: z.boolean().default(false),

  // Flags
  isActive: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  allowDiscount: z.boolean().default(true),
  taxRate: z.number().min(0).max(100).default(0),

  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const productFilterSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  productType: productTypeEnum.optional(),
  isActive: z.boolean().optional(),
  lowStock: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
