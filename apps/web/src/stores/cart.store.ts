import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Product, Customer, IMEIInventory, ProductBatch, CartItem, CartPayment } from '@pos/shared';
import type { LocalProduct } from '@/lib/db/schema';

type ProductLike = Product | LocalProduct;

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customer: Customer | null;
  discount: number;
  discountPercent: number;
  payments: CartPayment[];
  notes: string | null;

  // Computed
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  changeAmount: number;

  // Actions
  addItem: (product: ProductLike, quantity?: number, imei?: IMEIInventory, batch?: ProductBatch) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemDiscount: (itemId: string, discount: number, isPercent?: boolean) => void;
  removeItem: (itemId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: number, isPercent?: boolean) => void;
  addPayment: (payment: CartPayment) => void;
  removePayment: (index: number) => void;
  clearPayments: () => void;
  setNotes: (notes: string | null) => void;
  clearCart: () => void;
  recalculate: () => void;
}

function calculateTotals(state: CartState) {
  // Calculate item totals
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of state.items) {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = item.discountPercent
      ? (itemSubtotal * item.discountPercent) / 100
      : item.discount * item.quantity;
    const taxableAmount = itemSubtotal - itemDiscount;
    const itemTax = (taxableAmount * (item.product.taxRate || 0)) / 100;

    subtotal += taxableAmount;
    taxAmount += itemTax;
  }

  // Apply overall discount
  const overallDiscount = state.discountPercent
    ? (subtotal * state.discountPercent) / 100
    : state.discount;

  const total = subtotal - overallDiscount + taxAmount;
  const paidAmount = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const changeAmount = Math.max(0, paidAmount - total);
  const dueAmount = Math.max(0, total - paidAmount);

  return {
    subtotal,
    taxAmount,
    total,
    paidAmount,
    changeAmount,
    dueAmount,
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customer: null,
  discount: 0,
  discountPercent: 0,
  payments: [],
  notes: null,
  subtotal: 0,
  taxAmount: 0,
  total: 0,
  paidAmount: 0,
  dueAmount: 0,
  changeAmount: 0,

  addItem: (product, quantity = 1, imei, batch) => {
    const state = get();

    // For IMEI products, always add as new item
    if (imei) {
      const newItem: CartItem = {
        id: nanoid(),
        product: product as Product,
        imei,
        quantity: 1, // IMEI items always have quantity 1
        unitPrice: parseFloat(imei.salePrice || String(product.salePrice)),
        discount: 0,
        discountPercent: 0,
        notes: null,
      };

      set((state) => {
        const newState = { ...state, items: [...state.items, newItem] };
        return { ...newState, ...calculateTotals(newState) };
      });
      return;
    }

    // For batch products, check if same batch exists
    if (batch) {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === product.id && item.batch?.id === batch.id
      );

      if (existingIndex >= 0) {
        const items = [...state.items];
        items[existingIndex] = {
          ...items[existingIndex],
          quantity: items[existingIndex].quantity + quantity,
        };
        set((state) => {
          const newState = { ...state, items };
          return { ...newState, ...calculateTotals(newState) };
        });
        return;
      }

      const newItem: CartItem = {
        id: nanoid(),
        product: product as Product,
        batch,
        quantity,
        unitPrice: parseFloat(batch.salePrice || String(product.salePrice)),
        discount: 0,
        discountPercent: 0,
        notes: null,
      };

      set((state) => {
        const newState = { ...state, items: [...state.items, newItem] };
        return { ...newState, ...calculateTotals(newState) };
      });
      return;
    }

    // Regular product - check if exists
    const existingIndex = state.items.findIndex(
      (item) => item.product.id === product.id && !item.imei && !item.batch
    );

    if (existingIndex >= 0) {
      const items = [...state.items];
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: items[existingIndex].quantity + quantity,
      };
      set((state) => {
        const newState = { ...state, items };
        return { ...newState, ...calculateTotals(newState) };
      });
      return;
    }

    const newItem: CartItem = {
      id: nanoid(),
      product: product as Product,
      quantity,
      unitPrice: parseFloat(String(product.salePrice)),
      discount: 0,
      discountPercent: 0,
      notes: null,
    };

    set((state) => {
      const newState = { ...state, items: [...state.items, newItem] };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  updateItemQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }

    set((state) => {
      const items = state.items.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      );
      const newState = { ...state, items };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  updateItemDiscount: (itemId, discount, isPercent = false) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              discount: isPercent ? 0 : discount,
              discountPercent: isPercent ? discount : 0,
            }
          : item
      );
      const newState = { ...state, items };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  removeItem: (itemId) => {
    set((state) => {
      const items = state.items.filter((item) => item.id !== itemId);
      const newState = { ...state, items };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  setCustomer: (customer) => {
    set({ customer, customerId: customer?.id || null });
  },

  setDiscount: (discount, isPercent = false) => {
    set((state) => {
      const newState = {
        ...state,
        discount: isPercent ? 0 : discount,
        discountPercent: isPercent ? discount : 0,
      };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  addPayment: (payment) => {
    set((state) => {
      const payments = [...state.payments, payment];
      const newState = { ...state, payments };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  removePayment: (index) => {
    set((state) => {
      const payments = state.payments.filter((_, i) => i !== index);
      const newState = { ...state, payments };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  clearPayments: () => {
    set((state) => {
      const newState = { ...state, payments: [] };
      return { ...newState, ...calculateTotals(newState) };
    });
  },

  setNotes: (notes) => {
    set({ notes });
  },

  clearCart: () => {
    set({
      items: [],
      customerId: null,
      customer: null,
      discount: 0,
      discountPercent: 0,
      payments: [],
      notes: null,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      paidAmount: 0,
      dueAmount: 0,
      changeAmount: 0,
    });
  },

  recalculate: () => {
    set((state) => ({ ...state, ...calculateTotals(state) }));
  },
}));
