import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  Warehouse,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/hooks/useAuth';

// Core navigation - always visible
const coreNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'POS', href: '/pos', icon: ShoppingCart },
  { name: 'Sales', href: '/sales', icon: Receipt },
];

// Advanced navigation - collapsible
const advancedNavigation = [
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export function Sidebar() {
  const location = useLocation();
  const { organization } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // Auto-expand advanced menu if user is on an advanced page
  const isOnAdvancedPage = advancedNavigation.some(item => isActive(item.href));

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-56',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-sm font-semibold truncate">
                {organization?.name || 'POS'}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {/* Core Navigation */}
            {coreNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            ))}

            {/* Divider */}
            {!sidebarCollapsed && (
              <div className="my-2 border-t" />
            )}

            {/* Advanced Section - Collapsible */}
            {!sidebarCollapsed && (
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full"
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Admin</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  (showAdvanced || isOnAdvancedPage) && "rotate-180"
                )} />
              </button>
            )}

            {/* Advanced Navigation Items */}
            {(showAdvanced || isOnAdvancedPage || sidebarCollapsed) && (
              <div className={cn(!sidebarCollapsed && "pl-2")}>
                {advancedNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Footer - Settings link */}
        <div className="border-t p-2">
          <Link
            to="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
