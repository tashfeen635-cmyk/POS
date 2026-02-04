import { useState } from 'react';
import { Plus, Search, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { formatCurrency, formatPhone } from '@/lib/utils/format';
import { toast } from '@/components/ui/toaster';
import { useForm } from 'react-hook-form';
import type { CreateCustomerInput } from '@pos/shared';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: customersData, isLoading } = useCustomers({
    search: search || undefined,
    page: 1,
    limit: 50,
  });

  const createCustomer = useCreateCustomer();
  const customers = customersData?.data || [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCustomerInput>({
    defaultValues: {
      creditLimit: 0,
      isActive: true,
    },
  });

  const onSubmit = async (data: CreateCustomerInput) => {
    try {
      await createCustomer.mutateAsync(data);
      toast({ title: 'Customer created successfully', variant: 'success' });
      setIsDialogOpen(false);
      reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : customers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{customer.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {formatPhone(customer.phone)}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {customer.email}
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Balance</span>
                    <span
                      className={`font-medium ${
                        Number(customer.currentBalance) > 0
                          ? 'text-destructive'
                          : 'text-success'
                      }`}
                    >
                      {formatCurrency(customer.currentBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Purchases</span>
                    <span className="font-medium">
                      {formatCurrency(customer.totalPurchases)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No customers found</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first customer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="Enter customer name"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="03XX-XXXXXXX"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Enter address"
              />
            </div>
            <div>
              <Label htmlFor="creditLimit">Credit Limit (PKR)</Label>
              <Input
                id="creditLimit"
                type="number"
                {...register('creditLimit', { valueAsNumber: true })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
