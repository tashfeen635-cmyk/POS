import { useState } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { formatCurrency, formatPhone } from '@/lib/utils/format';
import { toast } from '@/components/ui/toaster';
import { useForm } from 'react-hook-form';
import type { Customer, CreateCustomerInput } from '@pos/shared';

interface CustomerSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer | null) => void;
}

export function CustomerSelector({ open, onOpenChange, onSelect }: CustomerSelectorProps) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: customersData, isLoading } = useCustomers({
    search: search || undefined,
    isActive: true,
    page: 1,
    limit: 20,
  });

  const createCustomer = useCreateCustomer();
  const customers = customersData?.data || [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCustomerInput>({
    defaultValues: {
      creditLimit: 0,
      isActive: true,
    },
  });

  const onCreateSubmit = async (data: CreateCustomerInput) => {
    try {
      const customer = await createCustomer.mutateAsync(data);
      toast({ title: 'Customer created', variant: 'success' });
      onSelect(customer);
      setShowCreate(false);
      reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };

  if (showCreate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="Customer name"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Back
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Customer List */}
          <ScrollArea className="h-[300px]">
            {/* Walk-in option */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted"
              onClick={() => onSelect(null)}
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Walk-in Customer</p>
                <p className="text-sm text-muted-foreground">No customer selected</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => onSelect(customer)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(customer.phone) || 'No phone'}
                    </p>
                  </div>
                  {parseFloat(customer.currentBalance) > 0 && (
                    <span className="text-sm text-destructive">
                      {formatCurrency(parseFloat(customer.currentBalance))}
                    </span>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
