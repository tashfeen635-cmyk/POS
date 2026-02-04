import { BarChart3, Download, TrendingUp, Package, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTodaySalesSummary } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useProducts';
import { useCustomersWithCredit } from '@/hooks/useCustomers';
import { formatCurrency } from '@/lib/utils/format';

export function ReportsPage() {
  const { data: todaySales } = useTodaySalesSummary();
  const { data: lowStockProducts } = useLowStockProducts();
  const { data: customersWithCredit } = useCustomersWithCredit();

  const totalCredit = (customersWithCredit || []).reduce(
    (sum, c) => sum + Number(c.currentBalance),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View business insights and reports</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todaySales?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todaySales?.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Credit</CardTitle>
            <Users className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCredit)}</div>
            <p className="text-xs text-muted-foreground">
              {customersWithCredit?.length || 0} customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Collection</CardTitle>
            <BarChart3 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todaySales?.cash || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Today's cash sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Reports</CardTitle>
            <CardDescription>Generate common reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="mr-2 h-4 w-4" />
              Daily Sales Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Package className="mr-2 h-4 w-4" />
              Inventory Valuation
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Customer Credit Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="mr-2 h-4 w-4" />
              Product-wise Sales
            </Button>
          </CardContent>
        </Card>

        {/* Customers with Credit */}
        <Card>
          <CardHeader>
            <CardTitle>Customers with Credit</CardTitle>
            <CardDescription>Outstanding balances to collect</CardDescription>
          </CardHeader>
          <CardContent>
            {customersWithCredit && customersWithCredit.length > 0 ? (
              <div className="space-y-3">
                {customersWithCredit.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    </div>
                    <p className="font-bold text-destructive">
                      {formatCurrency(customer.currentBalance)}
                    </p>
                  </div>
                ))}
                {customersWithCredit.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{customersWithCredit.length - 5} more customers
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No outstanding credit
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
