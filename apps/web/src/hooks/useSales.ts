import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { db, createOfflineSale } from '@/lib/db';
import { useUIStore } from '@/stores/ui.store';
import { useCartStore } from '@/stores/cart.store';
import { useAuthStore } from '@/stores/auth.store';
import { logger } from '@/lib/logging/logger';
import type { Sale, SaleFilterInput, CreateSaleInput } from '@pos/shared';
import type { LocalSale } from '@/lib/db/schema';

export function useSales(filters: SaleFilterInput = { page: 1, limit: 50 }) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['sales', filters],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.getPaginated<Sale>('/api/sales', filters as Record<string, string | number | boolean>);
        return response;
      } else {
        // Get from local DB
        const sales = await db.sales
          .orderBy('createdAt')
          .reverse()
          .offset((filters.page - 1) * filters.limit)
          .limit(filters.limit)
          .toArray();

        const total = await db.sales.count();

        return {
          data: sales as unknown as Sale[],
          meta: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit),
          },
        };
      }
    },
  });
}

export function useSale(id: string | undefined) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['sale', id],
    queryFn: async () => {
      if (!id) return null;

      if (isOnline) {
        const response = await api.get<Sale>(`/api/sales/${id}`);
        return response.data;
      } else {
        // Get from local DB
        const sale = await db.sales.get(id);
        return sale as unknown as Sale | null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const isOnline = useUIStore((state) => state.isOnline);
  const clearCart = useCartStore((state) => state.clearCart);
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (input: CreateSaleInput): Promise<LocalSale | Sale> => {
      if (isOnline) {
        try {
          const response = await api.post<Sale>('/api/sales', input);
          logger.info('Sale created online', { invoiceNumber: response.data?.invoiceNumber });
          return response.data as Sale;
        } catch (error) {
          logger.warn('Online sale failed, falling back to offline', { error: (error as Error).message });
          // Fall through to offline creation
        }
      }

      // Create sale offline using enhanced function
      const cart = useCartStore.getState();

      const sale = await createOfflineSale(
        user?.organizationId || '',
        user?.storeId || '',
        user?.id || '',
        cart.items.map((item) => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            costPrice: String(item.product.costPrice),
            taxRate: String(item.product.taxRate || 0),
          },
          imei: item.imei ? { id: item.imei.id, imei1: item.imei.imei1 } : null,
          batch: item.batch ? { id: item.batch.id, batchNumber: item.batch.batchNumber } : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent,
        })),
        cart.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference,
          tradeInId: p.tradeInId,
        })),
        cart.customerId,
        cart.discount,
        cart.discountPercent,
        input.notes || null
      );

      logger.info('Sale created offline', { invoiceNumber: sale.invoiceNumber, offlineId: sale.offlineId });

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      clearCart();
    },
    onError: (error) => {
      logger.error('Create sale failed', { error: (error as Error).message });
    },
  });
}

// Get local sale by ID (for receipt dialog)
export function useLocalSale(id: string | undefined) {
  return useQuery({
    queryKey: ['local-sale', id],
    queryFn: async (): Promise<LocalSale | null> => {
      if (!id) return null;
      const sale = await db.sales.get(id);
      return sale || null;
    },
    enabled: !!id,
  });
}

export function useTodaySalesSummary() {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['sales', 'today-summary'],
    queryFn: async () => {
      if (isOnline) {
        try {
          const response = await api.get<{
            total: number;
            count: number;
            cash: number;
            card: number;
            credit: number;
          }>('/api/sales/reports/today');
          return response.data;
        } catch {
          // Fall through to local calculation
        }
      }

      // Calculate from local DB
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sales = await db.sales
        .where('createdAt')
        .aboveOrEqual(today.toISOString())
        .toArray();

      let total = 0;
      let cash = 0;
      let card = 0;
      let credit = 0;

      for (const sale of sales) {
        total += parseFloat(sale.total);
        for (const payment of sale.payments) {
          const amount = parseFloat(payment.amount);
          switch (payment.method) {
            case 'cash':
              cash += amount;
              break;
            case 'card':
              card += amount;
              break;
            case 'credit':
              credit += amount;
              break;
          }
        }
      }

      return { total, count: sales.length, cash, card, credit };
    },
  });
}

export function useRecentSales(limit = 10) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['sales', 'recent', limit],
    queryFn: async () => {
      if (isOnline) {
        try {
          const response = await api.get<Sale[]>('/api/sales/reports/recent', { limit });
          return response.data;
        } catch {
          // Fall through to local
        }
      }

      // Get from local DB
      const sales = await db.sales.orderBy('createdAt').reverse().limit(limit).toArray();
      return sales as unknown as Sale[];
    },
  });
}

// Get pending sync sales count
export function usePendingSyncCount() {
  return useQuery({
    queryKey: ['sales', 'pending-sync'],
    queryFn: async () => {
      const count = await db.sales.where('_syncStatus').equals('pending').count();
      return count;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
