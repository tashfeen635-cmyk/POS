import { useState } from 'react';
import { Calendar, Package } from 'lucide-react';
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
import { useAvailableBatches } from '@/hooks/useInventory';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { Product, ProductBatch } from '@pos/shared';
import type { LocalBatch } from '@/lib/db/schema';

type BatchLike = ProductBatch | LocalBatch;

interface BatchSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSelect: (batch: ProductBatch, quantity: number) => void;
}

export function BatchSelector({ open, onOpenChange, product, onSelect }: BatchSelectorProps) {
  const [selectedBatch, setSelectedBatch] = useState<BatchLike | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { data: batches, isLoading } = useAvailableBatches(product.id);

  const handleSelect = () => {
    if (selectedBatch && quantity > 0) {
      onSelect(selectedBatch as ProductBatch, quantity);
      setSelectedBatch(null);
      setQuantity(1);
    }
  };

  const getAvailableQuantity = (batch: BatchLike) => {
    return batch.quantity - batch.soldQuantity;
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Batch - {product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Batch List */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : !batches || batches.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No available batches in stock
              </p>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const available = getAvailableQuantity(batch);
                  const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
                  const isExpiringSoon = daysUntilExpiry <= 30;

                  return (
                    <div
                      key={batch.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedBatch?.id === batch.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary'
                      }`}
                      onClick={() => setSelectedBatch(batch)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{batch.batchNumber}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-4 w-4" />
                            <span
                              className={isExpiringSoon ? 'text-warning' : ''}
                            >
                              Exp: {formatDate(batch.expiryDate)}
                              {isExpiringSoon && ` (${daysUntilExpiry}d)`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {formatCurrency(batch.salePrice || product.salePrice)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <Package className="h-4 w-4 inline mr-1" />
                            {available} available
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Quantity selector */}
          {selectedBatch && (
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <div className="flex gap-2">
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={getAvailableQuantity(selectedBatch)}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    setQuantity(Math.max(1, quantity - 1))
                  }
                >
                  -
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setQuantity(
                      Math.min(getAvailableQuantity(selectedBatch), quantity + 1)
                    )
                  }
                >
                  +
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Max: {getAvailableQuantity(selectedBatch)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedBatch || quantity < 1}>
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
