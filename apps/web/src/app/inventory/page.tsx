import { Link } from 'react-router-dom';
import { Smartphone, Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLowStockProducts } from '@/hooks/useProducts';
import { useExpiryAlerts } from '@/hooks/useInventory';
import { formatCurrency } from '@/lib/utils/format';

export function InventoryPage() {
  const { data: lowStockProducts } = useLowStockProducts();
  const { data: expiryAlerts } = useExpiryAlerts(90);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">Manage your stock and inventory</p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/inventory/imei">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>IMEI Inventory</CardTitle>
                  <CardDescription>Manage serial tracked devices</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/inventory/batches">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Batch Inventory</CardTitle>
                  <CardDescription>Manage batch/lot tracked items</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
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

        {/* Expiry Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Expiry Alert (90 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiryAlerts && expiryAlerts.length > 0 ? (
              <div className="space-y-3">
                {expiryAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.batch.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{(alert.product as any).name}</p>
                      <p className="text-sm text-muted-foreground">
                        Batch: {alert.batch.batchNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-destructive">
                        Exp: {alert.batch.expiryDate}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {alert.batch.quantity - alert.batch.soldQuantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No items expiring soon
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
