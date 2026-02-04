import { useState } from 'react';
import { Search, Plus, Minus, Trash2, User, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProducts, useProductByBarcode } from '@/hooks/useProducts';
import { useCartStore } from '@/stores/cart.store';
import { formatCurrency } from '@/lib/utils/format';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { CustomerSelector } from '@/components/pos/CustomerSelector';
import { IMEISelector } from '@/components/pos/IMEISelector';
import { BatchSelector } from '@/components/pos/BatchSelector';
import { IMEI_TRACKED_TYPES, BATCH_TRACKED_TYPES } from '@pos/shared';
import type { Product } from '@pos/shared';

export function POSPage() {
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showIMEISelector, setShowIMEISelector] = useState(false);
  const [showBatchSelector, setShowBatchSelector] = useState(false);

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    isActive: true,
    page: 1,
    limit: 50,
  });

  const scanBarcode = useProductByBarcode();

  const {
    items,
    customer,
    subtotal,
    discount,
    total,
    addItem,
    updateItemQuantity,
    removeItem,
    setCustomer,
  } = useCartStore();

  const products = productsData?.data || [];

  const handleProductClick = (product: Product) => {
    // Check if product needs IMEI selection
    if (IMEI_TRACKED_TYPES.includes(product.productType as any)) {
      setSelectedProduct(product);
      setShowIMEISelector(true);
      return;
    }

    // Check if product needs batch selection
    if (BATCH_TRACKED_TYPES.includes(product.productType as any)) {
      setSelectedProduct(product);
      setShowBatchSelector(true);
      return;
    }

    // Regular product - add directly
    addItem(product);
  };

  const handleBarcodeSearch = async (barcode: string) => {
    const product = await scanBarcode.mutateAsync(barcode);
    if (product) {
      handleProductClick(product);
      setSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.length > 5) {
      handleBarcodeSearch(search);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Products */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                    <p className="text-lg font-bold mt-1">
                      {formatCurrency(parseFloat(product.salePrice))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stock: {product.stockQuantity}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Cart */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Cart</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomer(true)}
            >
              <User className="h-4 w-4 mr-2" />
              {customer ? customer.name : 'Customer'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Items */}
          <ScrollArea className="flex-1 px-4">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Cart is empty
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      {item.imei && (
                        <p className="text-xs text-muted-foreground">
                          IMEI: {item.imei.imei1}
                        </p>
                      )}
                      {item.batch && (
                        <p className="text-xs text-muted-foreground">
                          Batch: {item.batch.batchNumber}
                        </p>
                      )}
                      <p className="text-sm font-medium">
                        {formatCurrency(item.unitPrice)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!item.imei && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Totals */}
          <div className="p-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">-{formatCurrency(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <Button
              className="w-full mt-4"
              size="lg"
              disabled={items.length === 0}
              onClick={() => setShowPayment(true)}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Pay {formatCurrency(total)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <PaymentModal open={showPayment} onOpenChange={setShowPayment} />
      <CustomerSelector
        open={showCustomer}
        onOpenChange={setShowCustomer}
        onSelect={(c) => {
          setCustomer(c);
          setShowCustomer(false);
        }}
      />
      {selectedProduct && (
        <>
          <IMEISelector
            open={showIMEISelector}
            onOpenChange={setShowIMEISelector}
            product={selectedProduct}
            onSelect={(imei) => {
              addItem(selectedProduct, 1, imei);
              setShowIMEISelector(false);
              setSelectedProduct(null);
            }}
          />
          <BatchSelector
            open={showBatchSelector}
            onOpenChange={setShowBatchSelector}
            product={selectedProduct}
            onSelect={(batch, qty) => {
              addItem(selectedProduct, qty, undefined, batch);
              setShowBatchSelector(false);
              setSelectedProduct(null);
            }}
          />
        </>
      )}
    </div>
  );
}
