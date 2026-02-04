import type { TradeInStatus } from '../constants/statuses';
import type { Customer } from './customer';

export interface TradeIn {
  id: string;
  organizationId: string;
  storeId: string;
  customerId: string | null;
  userId: string;

  // Customer details (for walk-ins)
  customerName: string | null;
  customerPhone: string | null;
  customerCnic: string | null;

  // Device details
  deviceBrand: string;
  deviceModel: string;
  imei: string | null;
  serialNumber: string | null;
  storage: string | null;
  color: string | null;

  // Condition
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  conditionNotes: string | null;
  hasOriginalBox: boolean;
  hasCharger: boolean;
  hasAccessories: boolean;

  // Pricing
  estimatedValue: number;
  offeredPrice: number;
  agreedPrice: number | null;

  status: TradeInStatus;
  saleId: string | null; // Linked sale when used as payment

  notes: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined
  customer?: Customer;
}
