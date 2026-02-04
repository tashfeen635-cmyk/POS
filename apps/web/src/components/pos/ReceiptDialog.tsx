// Receipt Dialog - Display and print receipts after sale
import { useState, useEffect } from 'react';
import { Printer, Share2, MessageCircle, Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  printReceipt,
  shareReceipt,
  sendReceiptWhatsApp,
  generateReceiptHTML,
  queueReceiptForPrint,
} from '@/lib/print/receipt';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { toast } from '@/components/ui/toaster';
import { useUIStore } from '@/stores/ui.store';
import type { LocalSale } from '@/lib/db/schema';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: LocalSale | null;
  customerPhone?: string | null;
}

export function ReceiptDialog({ open, onOpenChange, sale, customerPhone }: ReceiptDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string>('');
  const { isOnline } = useUIStore();

  useEffect(() => {
    if (sale && open) {
      generateReceiptHTML(sale).then(setReceiptHtml);
    }
  }, [sale, open]);

  if (!sale) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const success = await printReceipt(sale);
      if (success) {
        toast({
          title: 'Receipt printed',
          variant: 'success',
        });
      } else {
        throw new Error('Print failed');
      }
    } catch (error) {
      // Queue for later if offline
      if (!isOnline) {
        await queueReceiptForPrint(sale);
        toast({
          title: 'Receipt queued',
          description: 'Will print when connection is restored',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Print failed',
          description: 'Could not print receipt',
          variant: 'destructive',
        });
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    const success = await shareReceipt(sale);
    if (success) {
      toast({
        title: 'Receipt shared',
        variant: 'success',
      });
    }
  };

  const handleWhatsApp = () => {
    const phone = customerPhone || prompt('Enter phone number:');
    if (phone) {
      sendReceiptWhatsApp(sale, phone);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${sale.invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Receipt - {sale.invoiceNumber}</span>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-auto border rounded-lg bg-white">
          <div className="p-4 font-mono text-sm">
            {/* Header */}
            <div className="text-center mb-4">
              <h2 className="font-bold text-lg">POS System</h2>
              <p className="text-xs text-muted-foreground">
                Invoice: {sale.invoiceNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Date: {formatDate(new Date(sale.createdAt))}
              </p>
            </div>

            {/* Items */}
            <div className="border-t border-b border-dashed py-2 my-2">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left">Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="text-xs">
                      <td className="py-1">
                        <div className="truncate max-w-[120px]">{item.productName}</div>
                        {item.imeiNumber && (
                          <div className="text-[10px] text-muted-foreground">
                            IMEI: {item.imeiNumber}
                          </div>
                        )}
                        {item.batchNumber && (
                          <div className="text-[10px] text-muted-foreground">
                            Batch: {item.batchNumber}
                          </div>
                        )}
                      </td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(parseFloat(item.unitPrice), false)}</td>
                      <td className="text-right">{formatCurrency(parseFloat(item.total), false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(parseFloat(sale.subtotal), false)}</span>
              </div>
              {parseFloat(sale.discount) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Discount</span>
                  <span>-{formatCurrency(parseFloat(sale.discount), false)}</span>
                </div>
              )}
              {parseFloat(sale.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(parseFloat(sale.taxAmount), false)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(parseFloat(sale.total))}</span>
              </div>
            </div>

            {/* Payments */}
            <div className="mt-4 border-t pt-2">
              <p className="text-xs font-medium mb-1">Payment:</p>
              {sale.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-xs">
                  <span className="capitalize">{payment.method}</span>
                  <span>{formatCurrency(parseFloat(payment.amount), false)}</span>
                </div>
              ))}
              {parseFloat(sale.changeAmount) > 0 && (
                <div className="flex justify-between text-xs font-medium mt-1">
                  <span>Change</span>
                  <span>{formatCurrency(parseFloat(sale.changeAmount), false)}</span>
                </div>
              )}
              {parseFloat(sale.dueAmount) > 0 && (
                <div className="flex justify-between text-xs font-medium text-destructive mt-1">
                  <span>Amount Due</span>
                  <span>{formatCurrency(parseFloat(sale.dueAmount), false)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Thank you for your business!</p>
              <p className="font-medium mt-1">
                {sale.status === 'completed' ? 'PAID' : sale.status.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            className="flex-1"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Print
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleWhatsApp}>
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
