// Re-export from shared
export { formatCurrency as formatCurrencyFull, formatDate, formatDateTime, formatNumber } from '@pos/shared';

// Currency formatter with optional compact mode for receipts
export function formatCurrency(value: number, showSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat('en-PK', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

  return showSymbol ? `Rs. ${formatted}` : formatted;
}

// Additional format utilities

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  // Format Pakistani phone number
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatCNIC(cnic: string | null | undefined): string {
  if (!cnic) return '-';
  const cleaned = cnic.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
  }
  return cnic;
}

export function formatIMEI(imei: string | null | undefined): string {
  if (!imei) return '-';
  return imei;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatQuantity(quantity: number, unit: string = 'pcs'): string {
  return `${quantity} ${unit}`;
}

export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(then);
}
