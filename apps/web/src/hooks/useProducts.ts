import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { db, createSyncedMetadata } from '@/lib/db';
import { useUIStore } from '@/stores/ui.store';
import type { Product, Category, ProductFilterInput, CreateProductInput, UpdateProductInput } from '@pos/shared';

export function useProducts(filters: ProductFilterInput = { page: 1, limit: 50 }) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.getPaginated<Product>('/api/products', filters as Record<string, string | number | boolean>);
        // Cache products locally
        if (response.data) {
          await db.products.bulkPut(response.data.map(p => ({ ...p, ...createSyncedMetadata() })));
        }
        return response;
      } else {
        // Offline mode - query from IndexedDB
        let query = db.products.where('isActive').equals(true);

        const products = await query.toArray();
        return {
          success: true,
          data: products,
          pagination: {
            page: 1,
            limit: products.length,
            total: products.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      }
    },
  });
}

export function useProduct(id: string | undefined) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;

      if (isOnline) {
        const response = await api.get<Product>(`/api/products/${id}`);
        if (response.data) {
          await db.products.put({ ...response.data, ...createSyncedMetadata() });
        }
        return response.data;
      } else {
        return db.products.get(id);
      }
    },
    enabled: !!id,
  });
}

export function useProductByBarcode() {
  const isOnline = useUIStore((state) => state.isOnline);

  return useMutation({
    mutationFn: async (barcode: string) => {
      if (isOnline) {
        const response = await api.get<Product>(`/api/products/barcode/${barcode}`);
        return response.data;
      } else {
        return db.products.where('barcode').equals(barcode).first();
      }
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const response = await api.post<Product>('/api/products', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductInput }) => {
      const response = await api.put<Product>(`/api/products/${id}`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCategories() {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.get<Category[]>('/api/products/categories/list');
        if (response.data) {
          await db.categories.bulkPut(response.data.map(c => ({ ...c, ...createSyncedMetadata() })));
        }
        return response.data;
      } else {
        return db.categories.toArray();
      }
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: async () => {
      const response = await api.get<Product[]>('/api/products/alerts/low-stock');
      return response.data;
    },
  });
}
