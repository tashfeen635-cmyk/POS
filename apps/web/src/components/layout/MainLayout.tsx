import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
