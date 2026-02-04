import { useState } from 'react';
import { ArrowLeft, Plus, Search, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBatches } from '@/hooks/useInventory';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function BatchesPage() {
  const [search, setSearch] = useState('');
  const [expiringSoon, setExpiringSoon] = useState(false);

  const { data, isLoading } = useBatches({
    search: search || undefined,
    expiringSoon: expiringSoon || undefined,
    page: 1,
    limit: 50,
  });

  const batches = data?.data || [];

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

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
          <h1 className="text-2xl font-bold">Batch Inventory</h1>
          <p className="text-muted-foreground">Manage batch/lot tracked items</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Batch
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search batch number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="expiring"
                checked={expiringSoon}
                onCheckedChange={(c) => setExpiringSoon(c as boolean)}
              />
              <Label htmlFor="expiring" className="cursor-pointer">
                Expiring in 90 days
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : batches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => {
            const available = batch.quantity - batch.soldQuantity;
            const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
            const isExpiringSoon = daysUntilExpiry <= 30;
            const isExpired = daysUntilExpiry <= 0;

            return (
              <Card key={batch.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{batch.batchNumber}</CardTitle>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        isExpired
                          ? 'bg-destructive/10 text-destructive'
                          : isExpiringSoon
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {isExpired
                        ? 'Expired'
                        : isExpiringSoon
                        ? `${daysUntilExpiry}d left`
                        : 'Good'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Expires: {formatDate(batch.expiryDate)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-medium">{available} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total / Sold</span>
                      <span>
                        {batch.quantity} / {batch.soldQuantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost</span>
                      <span>{formatCurrency(parseFloat(batch.costPrice))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-medium">
                        {batch.salePrice
                          ? formatCurrency(parseFloat(batch.salePrice))
                          : '-'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No batches found</p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add your first batch
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
