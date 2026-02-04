import type { RepairStatus } from '../constants/statuses';
import type { Customer } from './customer';

export interface RepairOrder {
  id: string;
  organizationId: string;
  storeId: string;
  ticketNumber: string;
  customerId: string | null;
  userId: string;

  // Customer details
  customerName: string;
  customerPhone: string;
  customerCnic: string | null;

  // Device details
  deviceBrand: string;
  deviceModel: string;
  imei: string | null;
  serialNumber: string | null;
  password: string | null;

  // Issue
  issueDescription: string;
  accessories: string | null;
  deviceCondition: string | null;

  // Diagnosis & Repair
  diagnosis: string | null;
  partsUsed: string | null;

  // Pricing
  estimatedCost: number | null;
  laborCost: number | null;
  partsCost: number | null;
  totalCost: number | null;
  advancePayment: number;
  balanceDue: number;

  // Dates
  estimatedCompletionDate: string | null;
  completedAt: string | null;
  deliveredAt: string | null;

  status: RepairStatus;
  notes: string | null;

  createdAt: string;
  updatedAt: string;

  // Joined
  customer?: Customer;
}
