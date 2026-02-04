import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTodaySalesSummary, useRecentSales } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useProducts';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { useAuth } from '@/hooks/useAuth';

export function DashboardPage() {
  const { organization } = useAuth();
  const { data: todaySales, isLoading: loadingSales } = useTodaySalesSummary();
  const { data: recentSales } = useRecentSales(5);
  const { data: lowStockProducts } = useLowStockProducts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening at {organization?.name}
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/pos">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Open POS
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingSales ? '...' : formatCurrency(todaySales?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todaySales?.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingSales ? '...' : formatCurrency(todaySales?.cash || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Cash payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Card/UPI Sales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingSales ? '...' : formatCurrency(todaySales?.card || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Digital payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credit (Udhaar)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingSales ? '...' : formatCurrency(todaySales?.credit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">To be collected</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sales">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSales && recentSales.length > 0 ? (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{sale.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(sale.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(parseFloat(sale.total))}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {sale.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No sales today yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Low Stock Alert
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/inventory">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-4">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.sku || 'No SKU'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-destructive">
                        {product.stockQuantity} left
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Min: {product.minStockLevel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                All products are well stocked
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
