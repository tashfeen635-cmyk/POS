import type { ProductType, MedicineSchedule, DosageForm } from '../constants/product-types';

export interface Category {
  id: string;
  organizationId: string;
  name: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  productType: ProductType;

  // Pricing
  costPrice: number;
  salePrice: number;
  wholesalePrice: number | null;
  minSalePrice: number | null;

  // Stock
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  unit: string;

  // Mobile specific
  brand: string | null;
  model: string | null;
  color: string | null;
  storage: string | null;
  ram: string | null;
  warrantyDays: number | null;

  // Medical specific
  genericName: string | null;
  manufacturer: string | null;
  schedule: MedicineSchedule | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  packSize: number | null;
  unitsPerPack: number | null;
  requiresPrescription: boolean;

  // Flags
  isActive: boolean;
  trackInventory: boolean;
  allowDiscount: boolean;
  taxRate: number;

  description: string | null;
  notes: string | null;
  imageUrl: string | null;

  createdAt: string;
  updatedAt: string;

  // Computed / Joined
  category?: Category;
}

export interface ProductWithStock extends Product {
  availableStock: number;
  reservedStock: number;
}
