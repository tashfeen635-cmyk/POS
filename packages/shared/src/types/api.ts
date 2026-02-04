// API Response types

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Dashboard stats
export interface DashboardStats {
  todaySales: {
    total: number;
    count: number;
    cash: number;
    card: number;
    credit: number;
  };
  weekSales: {
    total: number;
    count: number;
  };
  monthSales: {
    total: number;
    count: number;
  };
  lowStockCount: number;
  expiringCount: number;
  pendingRepairs: number;
  pendingTradeIns: number;
}

export interface SalesReport {
  date: string;
  salesCount: number;
  totalAmount: number;
  costAmount: number;
  profit: number;
  paymentBreakdown: Record<string, number>;
}

export interface ProductSalesReport {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}
