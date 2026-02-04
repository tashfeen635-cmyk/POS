import { useState } from 'react';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useIMEIInventory } from '@/hooks/useInventory';
import { formatCurrency } from '@/lib/utils/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IMEI_STATUS } from '@pos/shared';

export function IMEIPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useIMEIInventory({
    search: search || undefined,
    status: status as any || undefined,
    page: 1,
    limit: 50,
  });

  const items = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/inventory">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">IMEI Inventory</h1>
          <p className="text-muted-foreground">Manage serial tracked devices</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add IMEI
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value={IMEI_STATUS.IN_STOCK}>In Stock</SelectItem>
                <SelectItem value={IMEI_STATUS.SOLD}>Sold</SelectItem>
                <SelectItem value={IMEI_STATUS.RESERVED}>Reserved</SelectItem>
                <SelectItem value={IMEI_STATUS.DEFECTIVE}>Defective</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* IMEI List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm">{item.imei1}</p>
                    {item.imei2 && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.imei2}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.status === 'in_stock'
                        ? 'bg-success/10 text-success'
                        : item.status === 'sold'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Color</span>
                    <span>{item.color || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage</span>
                    <span>{item.storage || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span className="capitalize">{item.condition}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Cost</span>
                    <span>{formatCurrency(item.costPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sale Price</span>
                    <span className="font-medium">
                      {formatCurrency(item.salePrice || 0)}
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
            <p className="text-muted-foreground mb-4">No IMEI records found</p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add your first IMEI
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
