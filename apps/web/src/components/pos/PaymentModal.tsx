import { useState } from 'react';
import { Banknote, CreditCard, Smartphone, Wallet, WifiOff } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/stores/cart.store';
import { useUIStore } from '@/stores/ui.store';
import { useCreateSale } from '@/hooks/useSales';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from '@/components/ui/toaster';
import { ReceiptDialog } from './ReceiptDialog';
import { PAYMENT_METHODS } from '@pos/shared';
import type { PaymentMethod } from '@pos/shared';
import type { LocalSale } from '@/lib/db/schema';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethods = [
  { id: PAYMENT_METHODS.CASH, label: 'Cash', icon: Banknote },
  { id: PAYMENT_METHODS.CARD, label: 'Card', icon: CreditCard },
  { id: PAYMENT_METHODS.UPI, label: 'JazzCash/Easypaisa', icon: Smartphone },
  { id: PAYMENT_METHODS.CREDIT, label: 'Credit (Udhaar)', icon: Wallet },
];

export function PaymentModal({ open, onOpenChange }: PaymentModalProps) {
  const {
    items,
    customerId,
    customer,
    total,
    discount,
    discountPercent,
    payments,
    addPayment,
    clearPayments,
    clearCart,
  } = useCartStore();

  const { isOnline } = useUIStore();
  const createSale = useCreateSale();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<LocalSale | null>(null);

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = total - paidAmount;
  const changeAmount = Math.max(0, paidAmount - total);

  const handleAddPayment = () => {
    const paymentAmount = parseFloat(amount) || remainingAmount;
    if (paymentAmount <= 0) return;

    addPayment({
      method: selectedMethod,
      amount: paymentAmount,
      reference: reference || null,
      tradeInId: null,
    });

    setAmount('');
    setReference('');
  };

  const handleCompleteSale = async () => {
    // Add payment if not already added
    if (payments.length === 0) {
      const paymentAmount = parseFloat(amount) || total;
      addPayment({
        method: selectedMethod,
        amount: paymentAmount,
        reference: reference || null,
        tradeInId: null,
      });
    }

    try {
      const saleInput = {
        customerId: customerId || undefined,
        items: items.map((item) => ({
          productId: item.product.id,
          imeiId: item.imei?.id || undefined,
          batchId: item.batch?.id || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent,
          taxRate: item.product.taxRate ? parseFloat(item.product.taxRate) : 0,
        })),
        payments:
          payments.length > 0
            ? payments
            : [
                {
                  method: selectedMethod,
                  amount: parseFloat(amount) || total,
                  reference: reference || undefined,
                },
              ],
        discount,
        discountPercent,
      };

      const sale = await createSale.mutateAsync(saleInput);

      // Cast to LocalSale for receipt dialog
      const localSale = sale as LocalSale;

      toast({
        title: 'Sale completed!',
        description: `Invoice: ${localSale.invoiceNumber}${!isOnline ? ' (Offline)' : ''}`,
        variant: 'success',
      });

      // Show receipt dialog
      setCompletedSale(localSale);
      setShowReceipt(true);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Sale failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    clearPayments();
    setAmount('');
    setReference('');
    onOpenChange(false);
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setCompletedSale(null);
    clearCart();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Payment
              {!isOnline && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Offline indicator */}
            {!isOnline && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-lg">
                You're offline. Sale will be saved locally and synced when connection is restored.
              </div>
            )}

            {/* Total */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) => (
                <Button
                  key={method.id}
                  variant={selectedMethod === method.id ? 'default' : 'outline'}
                  className="h-auto py-3 flex flex-col gap-1"
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <method.icon className="h-5 w-5" />
                  <span className="text-xs">{method.label}</span>
                </Button>
              ))}
            </div>

            {/* Amount Input */}
            <div>
              <Label htmlFor="amount">Amount (PKR)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={formatCurrency(remainingAmount > 0 ? remainingAmount : total)}
                className="text-lg"
              />
            </div>

            {/* Reference for non-cash */}
            {selectedMethod !== 'cash' && selectedMethod !== 'credit' && (
              <div>
                <Label htmlFor="reference">Reference / Transaction ID</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Enter reference number"
                />
              </div>
            )}

            {/* Payments List */}
            {payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Payments:</p>
                  {payments.map((payment, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="capitalize">{payment.method}</span>
                      <span>{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium">
                    <span>Remaining</span>
                    <span
                      className={remainingAmount > 0 ? 'text-destructive' : 'text-green-600'}
                    >
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                  {changeAmount > 0 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span>Change</span>
                      <span className="text-green-600">{formatCurrency(changeAmount)}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quick amounts */}
            <div className="flex gap-2">
              {[100, 500, 1000, 5000].map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(String(quickAmount))}
                >
                  {quickAmount}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {payments.length === 0 && (
              <Button variant="outline" onClick={handleAddPayment} disabled={!amount}>
                Add Split Payment
              </Button>
            )}
            <Button
              onClick={handleCompleteSale}
              disabled={createSale.isPending || (payments.length > 0 && remainingAmount > 0)}
            >
              {createSale.isPending ? 'Processing...' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={showReceipt}
        onOpenChange={handleReceiptClose}
        sale={completedSale}
        customerPhone={customer?.phone}
      />
    </>
  );
}
