export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  creditLimit: number;
  currentBalance: number; // Positive = customer owes, Negative = store owes
  totalPurchases: number;
  totalPaid: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithStats extends Customer {
  salesCount: number;
  lastPurchaseDate: string | null;
}
