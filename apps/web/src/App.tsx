import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';

// Layouts
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';

// Pages
import { LoginPage } from '@/app/login/page';
import { DashboardPage } from '@/app/page';
import { POSPage } from '@/app/pos/page';
import { ProductsPage } from '@/app/products/page';
import { ProductFormPage } from '@/app/products/[id]/page';
import { InventoryPage } from '@/app/inventory/page';
import { IMEIPage } from '@/app/inventory/imei/page';
import { BatchesPage } from '@/app/inventory/batches/page';
import { CustomersPage } from '@/app/customers/page';
import { SalesPage } from '@/app/sales/page';
import { ReportsPage } from '@/app/reports/page';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductFormPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/imei" element={<IMEIPage />} />
          <Route path="/inventory/batches" element={<BatchesPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
