import type { SaleStatus, PaymentMethod } from '../constants';
import type { Product } from './product';
import type { Customer } from './customer';
import type { IMEIInventory, ProductBatch } from './inventory';

export interface Sale {
  id: string;
  organizationId: string;
  storeId: string;
  invoiceNumber: string;
  customerId: string | null;
  userId: string;

  // Amounts
  subtotal: number;
  discount: number;
  discountPercent: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount: number;

  status: SaleStatus;
  notes: string | null;

  // Offline support
  offlineId: string | null;
  syncedAt: string | null;

  createdAt: string;
  updatedAt: string;

  // Joined
  customer?: Customer;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  imeiId: string | null;
  batchId: string | null;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  notes: string | null;
  createdAt: string;

  // Joined
  product?: Product;
  imei?: IMEIInventory;
  batch?: ProductBatch;
}

export interface SalePayment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  tradeInId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SaleReturn {
  id: string;
  saleId: string;
  userId: string;
  totalRefund: number;
  refundMethod: PaymentMethod;
  reason: string | null;
  notes: string | null;
  createdAt: string;

  items?: SaleReturnItem[];
}

export interface SaleReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  quantity: number;
  refundAmount: number;
  reason: string | null;
}

// For POS cart
export interface CartItem {
  id: string; // Client-side ID
  product: Product;
  imei?: IMEIInventory;
  batch?: ProductBatch;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountPercent: number;
  notes: string | null;
}

export interface CartPayment {
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  tradeInId: string | null;
}

export interface CartState {
  items: CartItem[];
  customerId: string | null;
  customer: Customer | null;
  discount: number;
  discountPercent: number;
  payments: CartPayment[];
  notes: string | null;
}
