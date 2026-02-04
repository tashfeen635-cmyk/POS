export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',
  TRADE_IN: 'trade_in',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.CASH]: 'Cash',
  [PAYMENT_METHODS.CARD]: 'Card',
  [PAYMENT_METHODS.UPI]: 'UPI / JazzCash / Easypaisa',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_METHODS.CREDIT]: 'Credit (Udhaar)',
  [PAYMENT_METHODS.TRADE_IN]: 'Trade-In',
};
