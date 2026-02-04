import type { IMEIStatus, InventoryMovementType } from '../constants/statuses';
import type { Product } from './product';

export interface IMEIInventory {
  id: string;
  organizationId: string;
  storeId: string;
  productId: string;
  imei1: string;
  imei2: string | null;
  serialNumber: string | null;
  status: IMEIStatus;
  costPrice: number;
  salePrice: number | null;
  color: string | null;
  storage: string | null;
  condition: 'new' | 'refurbished' | 'used';
  purchaseDate: string | null;
  supplierId: string | null;
  warrantyExpiry: string | null;
  soldAt: string | null;
  saleId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined
  product?: Product;
}

export interface ProductBatch {
  id: string;
  organizationId: string;
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  manufacturingDate: string | null;
  quantity: number;
  soldQuantity: number;
  costPrice: number;
  salePrice: number | null;
  mrp: number | null;
  supplierId: string | null;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined
  product?: Product;
}

export interface InventoryLedger {
  id: string;
  organizationId: string;
  storeId: string;
  productId: string;
  batchId: string | null;
  imeiId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reference: string | null;
  referenceId: string | null;
  reason: string | null;
  userId: string;
  createdAt: string;

  // Joined
  product?: Product;
}

export interface ExpiryAlert {
  batch: ProductBatch;
  product: Product;
  daysUntilExpiry: number;
  isExpired: boolean;
}

export interface LowStockAlert {
  product: Product;
  currentStock: number;
  minStockLevel: number;
}

export interface WarrantyExpiringAlert {
  imei: IMEIInventory;
  product: Product;
  daysUntilExpiry: number;
}
