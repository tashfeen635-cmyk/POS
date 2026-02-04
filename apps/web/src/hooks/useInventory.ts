import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { db } from '@/lib/db';
import { useUIStore } from '@/stores/ui.store';
import type {
  IMEIInventory,
  ProductBatch,
  IMEIFilterInput,
  BatchFilterInput,
  CreateIMEIInput,
  CreateBatchInput,
} from '@pos/shared';

// IMEI Inventory hooks
export function useIMEIInventory(filters: IMEIFilterInput = { page: 1, limit: 50 }) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['imei-inventory', filters],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.getPaginated<IMEIInventory>('/api/inventory/imei', filters as Record<string, string | number | boolean>);
        if (response.data) {
          await db.imeiInventory.bulkPut(response.data.map(i => ({ ...i, _syncStatus: 'synced' as const })));
        }
        return response;
      } else {
        const items = await db.imeiInventory.toArray();
        return {
          success: true,
          data: items,
          pagination: {
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      }
    },
  });
}

export function useAvailableIMEIs(productId: string | undefined) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['imei-inventory', 'available', productId],
    queryFn: async () => {
      if (!productId) return [];

      if (isOnline) {
        const response = await api.get<IMEIInventory[]>(`/api/inventory/imei/available/${productId}`);
        return response.data;
      } else {
        return db.imeiInventory
          .where('productId')
          .equals(productId)
          .and((item) => item.status === 'in_stock')
          .toArray();
      }
    },
    enabled: !!productId,
  });
}

export function useCreateIMEI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIMEIInput) => {
      const response = await api.post<IMEIInventory>('/api/inventory/imei', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imei-inventory'] });
    },
  });
}

// Batch Inventory hooks
export function useBatches(filters: BatchFilterInput = { page: 1, limit: 50 }) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['batches', filters],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.getPaginated<ProductBatch>('/api/inventory/batches', filters as Record<string, string | number | boolean>);
        if (response.data) {
          await db.productBatches.bulkPut(response.data.map(b => ({ ...b, _syncStatus: 'synced' as const })));
        }
        return response;
      } else {
        const batches = await db.productBatches.toArray();
        return {
          success: true,
          data: batches,
          pagination: {
            page: 1,
            limit: batches.length,
            total: batches.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      }
    },
  });
}

export function useAvailableBatches(productId: string | undefined) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['batches', 'available', productId],
    queryFn: async () => {
      if (!productId) return [];

      if (isOnline) {
        const response = await api.get<ProductBatch[]>(`/api/inventory/batches/available/${productId}`);
        return response.data;
      } else {
        const today = new Date().toISOString().split('T')[0];
        return db.productBatches
          .where('productId')
          .equals(productId)
          .filter((batch) => {
            const available = batch.quantity - batch.soldQuantity;
            return available > 0 && batch.expiryDate >= today;
          })
          .toArray();
      }
    },
    enabled: !!productId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBatchInput) => {
      const response = await api.post<ProductBatch>('/api/inventory/batches', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Expiry Alerts
export function useExpiryAlerts(days = 90) {
  return useQuery({
    queryKey: ['inventory', 'expiry-alerts', days],
    queryFn: async () => {
      const response = await api.get<Array<{ batch: ProductBatch; product: unknown }>>('/api/inventory/alerts/expiry', { days });
      return response.data;
    },
  });
}
