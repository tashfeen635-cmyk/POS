import { Link } from 'react-router-dom';
import { ShoppingCart, TrendingUp, Banknote, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTodaySalesSummary, useRecentSales } from '@/hooks/useSales';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export function DashboardPage() {
  const { data: todaySales, isLoading: loadingSales } = useTodaySalesSummary();
  const { data: recentSales } = useRecentSales(5);

  return (
    <div className="space-y-6">
      {/* Quick Access to POS */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-2xl font-bold">Quick Start</h1>
            <p className="text-primary-foreground/80">
              Ready to make a sale? Click to open POS
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg">
            <Link to="/pos">
              <ShoppingCart className="mr-2 h-6 w-6" />
              Open POS
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Today's Stats - Simple 3 column */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loadingSales ? '...' : formatCurrency(todaySales?.total || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              {todaySales?.count || 0} sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash</CardTitle>
            <Banknote className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {loadingSales ? '...' : formatCurrency(todaySales?.cash || 0)}
            </div>
            <p className="text-sm text-muted-foreground">In drawer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credit (Udhaar)</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">
              {loadingSales ? '...' : formatCurrency(todaySales?.credit || 0)}
            </div>
            <p className="text-sm text-muted-foreground">To collect</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales - Full width */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Sales</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/sales">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales && recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(sale.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(sale.total)}</p>
                    <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                      sale.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {sale.status === 'completed' ? 'Paid' : sale.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sales today yet</p>
              <Button asChild className="mt-4">
                <Link to="/pos">Make your first sale</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
