import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts, useProductByBarcode } from '@/hooks/useProducts';
import { useCartStore } from '@/stores/cart.store';
import { useCreateSale } from '@/hooks/useSales';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from '@/components/ui/toaster';
import { printReceipt } from '@/lib/print/receipt';
import { IMEISelector } from '@/components/pos/IMEISelector';
import { BatchSelector } from '@/components/pos/BatchSelector';
import { IMEI_TRACKED_TYPES, BATCH_TRACKED_TYPES } from '@pos/shared';
import type { Product } from '@pos/shared';
import type { LocalProduct, LocalSale } from '@/lib/db/schema';

type ProductLike = Product | LocalProduct;

export function POSPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductLike | null>(null);
  const [showIMEISelector, setShowIMEISelector] = useState(false);
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    isActive: true,
    page: 1,
    limit: 50,
  });

  const scanBarcode = useProductByBarcode();
  const createSale = useCreateSale();

  const {
    items,
    total,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
  } = useCartStore();

  const products = productsData?.data || [];

  // Focus search on mount and keyboard shortcut
  useEffect(() => {
    searchRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 - Focus search
      if (e.key === 'F1') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // F3 - Quick cash payment (if cart has items)
      if (e.key === 'F3' && items.length > 0) {
        e.preventDefault();
        handleQuickCashPayment();
      }
      // F4 - Clear cart
      if (e.key === 'F4') {
        e.preventDefault();
        clearCart();
      }
      // Escape - Clear search
      if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length]);

  const handleProductClick = (product: ProductLike) => {
    // Check if product needs IMEI selection (mobile devices)
    if (IMEI_TRACKED_TYPES.includes(product.productType as any)) {
      setSelectedProduct(product);
      setShowIMEISelector(true);
      return;
    }

    // Check if product needs batch selection (medicines)
    if (BATCH_TRACKED_TYPES.includes(product.productType as any)) {
      setSelectedProduct(product);
      setShowBatchSelector(true);
      return;
    }

    // Regular product - add directly
    addItem(product);
    // Play success sound (optional)
    playBeep();
  };

  const handleBarcodeSearch = async (barcode: string) => {
    try {
      const product = await scanBarcode.mutateAsync(barcode);
      if (product) {
        handleProductClick(product);
        setSearch('');
      }
    } catch {
      playErrorBeep();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.length > 3) {
      // Try barcode first
      handleBarcodeSearch(search);
    }
  };

  // Quick cash payment - one click complete sale
  const handleQuickCashPayment = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const saleInput = {
        items: items.map((item) => ({
          productId: item.product.id,
          imeiId: item.imei?.id || undefined,
          batchId: item.batch?.id || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent,
          taxRate: item.product.taxRate ? parseFloat(String(item.product.taxRate)) : 0,
        })),
        payments: [{ method: 'cash' as const, amount: total }],
        discount: 0,
        discountPercent: 0,
      };

      const sale = await createSale.mutateAsync(saleInput);
      const localSale = sale as LocalSale;

      toast({
        title: `Sale Complete - ${localSale.invoiceNumber}`,
        variant: 'success',
      });

      // Auto-print receipt
      try {
        await printReceipt(localSale);
      } catch {
        // Silent fail for print
      }

      // Clear cart and focus search for next customer
      clearCart();
      searchRef.current?.focus();
    } catch (error) {
      toast({
        title: 'Sale Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Simple beep sounds
  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  };

  const playErrorBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 300;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex gap-4">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col">
        {/* Search Bar - Always visible */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Scan barcode or search... (F1)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 h-12 text-lg"
              autoFocus
            />
          </div>
        </div>

        {/* Products Grid */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {search ? 'No products found' : 'Start typing to search'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>
                    <p className="text-xl font-bold text-primary mt-1">
                      {formatCurrency(product.salePrice)}
                    </p>
                    {product.stockQuantity <= 5 && (
                      <p className="text-xs text-destructive">
                        Low: {product.stockQuantity}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Cart - Simplified */}
      <Card className="w-80 flex flex-col bg-card">
        {/* Cart Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold">
            Cart ({items.length})
          </span>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-destructive hover:text-destructive"
            >
              Clear (F4)
            </Button>
          )}
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <p>Cart is empty</p>
              <p className="text-xs mt-1">Click products to add</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!item.imei && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
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

        {/* Cart Footer - Payment */}
        <div className="p-3 border-t space-y-3">
          {/* Total - Big and clear */}
          <div className="text-center py-2 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">TOTAL</p>
            <p className="text-3xl font-bold">{formatCurrency(total)}</p>
          </div>

          {/* One-Click Cash Payment */}
          <Button
            className="w-full h-14 text-lg font-bold"
            size="lg"
            disabled={items.length === 0 || isProcessing}
            onClick={handleQuickCashPayment}
          >
            {isProcessing ? (
              'Processing...'
            ) : (
              <>
                <Printer className="mr-2 h-5 w-5" />
                PAY CASH & PRINT (F3)
              </>
            )}
          </Button>

          {/* Keyboard hints */}
          <div className="text-xs text-center text-muted-foreground space-x-3">
            <span>F1: Search</span>
            <span>F3: Pay</span>
            <span>F4: Clear</span>
          </div>
        </div>
      </Card>

      {/* IMEI/Batch Selectors - Only when needed */}
      {selectedProduct && (
        <>
          <IMEISelector
            open={showIMEISelector}
            onOpenChange={setShowIMEISelector}
            product={selectedProduct as Product}
            onSelect={(imei) => {
              addItem(selectedProduct, 1, imei);
              setShowIMEISelector(false);
              setSelectedProduct(null);
              playBeep();
            }}
          />
          <BatchSelector
            open={showBatchSelector}
            onOpenChange={setShowBatchSelector}
            product={selectedProduct as Product}
            onSelect={(batch, qty) => {
              addItem(selectedProduct, qty, undefined, batch);
              setShowBatchSelector(false);
              setSelectedProduct(null);
              playBeep();
            }}
          />
        </>
      )}
    </div>
  );
}
