import { useState } from 'react';
import { Search, Receipt, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSales } from '@/hooks/useSales';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { Sale } from '@pos/shared';

export function SalesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data, isLoading } = useSales({
    search: search || undefined,
    status: status as any || undefined,
    page: 1,
    limit: 50,
  });

  const sales = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sales History</h1>
        <p className="text-muted-foreground">View and manage your sales</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice number..."
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sales List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sales.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Invoice</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Paid</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{sale.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="p-4 font-medium">
                        {formatCurrency(parseFloat(sale.total))}
                      </td>
                      <td className="p-4">
                        {formatCurrency(parseFloat(sale.paidAmount))}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            sale.status === 'completed'
                              ? 'bg-success/10 text-success'
                              : sale.status === 'partially_paid'
                              ? 'bg-warning/10 text-warning'
                              : sale.status === 'pending'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {sale.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sales found</p>
          </CardContent>
        </Card>
      )}

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice {selectedSale?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {formatDateTime(selectedSale.createdAt)}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(parseFloat(selectedSale.subtotal))}</span>
                </div>
                {parseFloat(selectedSale.discount) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                    <span>-{formatCurrency(parseFloat(selectedSale.discount))}</span>
                  </div>
                )}
                {parseFloat(selectedSale.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(parseFloat(selectedSale.taxAmount))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(parseFloat(selectedSale.total))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatCurrency(parseFloat(selectedSale.paidAmount))}</span>
                </div>
                {parseFloat(selectedSale.dueAmount) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Due</span>
                    <span>{formatCurrency(parseFloat(selectedSale.dueAmount))}</span>
                  </div>
                )}
                {parseFloat(selectedSale.changeAmount) > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Change</span>
                    <span>{formatCurrency(parseFloat(selectedSale.changeAmount))}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Print Receipt
                </Button>
                <Button variant="outline" className="flex-1">
                  Share
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
