import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { db, generateOfflineId } from '@/lib/db';
import { useUIStore } from '@/stores/ui.store';
import type { Customer, CustomerFilterInput, CreateCustomerInput, UpdateCustomerInput } from '@pos/shared';

export function useCustomers(filters: CustomerFilterInput = { page: 1, limit: 50 }) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      if (isOnline) {
        const response = await api.getPaginated<Customer>('/api/customers', filters as Record<string, string | number | boolean>);
        // Cache customers locally
        if (response.data) {
          await db.customers.bulkPut(response.data.map(c => ({ ...c, _syncStatus: 'synced' as const })));
        }
        return response;
      } else {
        // Offline mode
        const customers = await db.customers.where('isActive').equals(true).toArray();
        return {
          success: true,
          data: customers,
          pagination: {
            page: 1,
            limit: customers.length,
            total: customers.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      }
    },
  });
}

export function useCustomer(id: string | undefined) {
  const isOnline = useUIStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null;

      if (isOnline) {
        const response = await api.get<Customer>(`/api/customers/${id}`);
        if (response.data) {
          await db.customers.put({ ...response.data, _syncStatus: 'synced' });
        }
        return response.data;
      } else {
        return db.customers.get(id);
      }
    },
    enabled: !!id,
  });
}

export function useCustomerByPhone() {
  const isOnline = useUIStore((state) => state.isOnline);

  return useMutation({
    mutationFn: async (phone: string) => {
      if (isOnline) {
        try {
          const response = await api.get<Customer>(`/api/customers/phone/${phone}`);
          return response.data;
        } catch {
          return null;
        }
      } else {
        return db.customers.where('phone').equals(phone).first() || null;
      }
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const isOnline = useUIStore((state) => state.isOnline);

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      if (isOnline) {
        const response = await api.post<Customer>('/api/customers', input);
        return response.data;
      } else {
        // Create locally with offline ID
        const offlineCustomer: Customer = {
          id: generateOfflineId(),
          organizationId: '', // Will be set by server
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          cnic: input.cnic || null,
          address: input.address || null,
          city: input.city || null,
          creditLimit: input.creditLimit || 0,
          currentBalance: 0,
          totalPurchases: 0,
          totalPaid: 0,
          notes: input.notes || null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.customers.add({
          ...offlineCustomer,
          _syncStatus: 'pending',
          _clientId: localStorage.getItem('clientId') || '',
          _clientCreatedAt: new Date().toISOString(),
          _clientUpdatedAt: new Date().toISOString(),
          _syncAttempts: 0,
        });

        // Add to sync queue
        await db.syncQueue.add({
          table: 'customers',
          operation: 'create',
          recordId: offlineCustomer.id,
          data: input as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
          attempts: 0,
        });

        return offlineCustomer;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCustomerInput }) => {
      const response = await api.put<Customer>(`/api/customers/${id}`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCustomersWithCredit() {
  return useQuery({
    queryKey: ['customers', 'credit'],
    queryFn: async () => {
      const response = await api.get<Customer[]>('/api/customers/reports/credit');
      return response.data;
    },
  });
}
