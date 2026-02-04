// Pakistan locale settings
export const LOCALE = {
  CURRENCY: 'PKR',
  CURRENCY_SYMBOL: 'Rs.',
  LOCALE_CODE: 'en-PK',
  ALTERNATE_LOCALE: 'ur-PK',
  DATE_FORMAT: 'DD/MM/YYYY',
  TIME_FORMAT: 'hh:mm A',
  DATETIME_FORMAT: 'DD/MM/YYYY hh:mm A',
  TIMEZONE: 'Asia/Karachi',
} as const;

// Format number in South Asian style (1,23,456.00)
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${LOCALE.CURRENCY_SYMBOL} ${formatted}`;
}

// Parse South Asian formatted number
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format datetime
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDate(d);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${dateStr} ${String(hour12).padStart(2, '0')}:${minutes} ${ampm}`;
}

// Format number with South Asian grouping
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
