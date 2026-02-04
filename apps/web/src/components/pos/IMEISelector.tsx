import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAvailableIMEIs } from '@/hooks/useInventory';
import { formatCurrency } from '@/lib/utils/format';
import type { Product, IMEIInventory } from '@pos/shared';
import { useState } from 'react';

interface IMEISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSelect: (imei: IMEIInventory) => void;
}

export function IMEISelector({ open, onOpenChange, product, onSelect }: IMEISelectorProps) {
  const [search, setSearch] = useState('');
  const { data: imeis, isLoading } = useAvailableIMEIs(product.id);

  const filteredIMEIs = (imeis || []).filter(
    (imei) =>
      imei.imei1.includes(search) ||
      imei.imei2?.includes(search) ||
      imei.serialNumber?.includes(search)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select IMEI - {product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* IMEI List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredIMEIs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No available units in stock
              </p>
            ) : (
              <div className="space-y-2">
                {filteredIMEIs.map((imei) => (
                  <div
                    key={imei.id}
                    className="p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => onSelect(imei)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm">{imei.imei1}</p>
                        {imei.imei2 && (
                          <p className="font-mono text-sm text-muted-foreground">
                            {imei.imei2}
                          </p>
                        )}
                      </div>
                      <p className="font-bold">
                        {formatCurrency(parseFloat(imei.salePrice || product.salePrice))}
                      </p>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      {imei.color && <span>{imei.color}</span>}
                      {imei.storage && <span>{imei.storage}</span>}
                      <span className="capitalize">{imei.condition}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
