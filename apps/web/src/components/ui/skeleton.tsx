import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rounded';
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        {
          'rounded-md': variant === 'default',
          'rounded-full': variant === 'circular',
          'rounded-lg': variant === 'rounded',
        },
        className
      )}
      {...props}
    />
  );
}

// Product card skeleton
function ProductCardSkeleton() {
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <Skeleton className="h-20 w-full" variant="rounded" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-6 w-16" variant="rounded" />
      </div>
    </div>
  );
}

// Product grid skeleton
function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Cart item skeleton
function CartItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b">
      <Skeleton className="h-12 w-12 flex-shrink-0" variant="rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-20" variant="rounded" />
      </div>
    </div>
  );
}

// Cart skeleton
function CartSkeleton({ itemCount = 3 }: { itemCount?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: itemCount }).map((_, i) => (
        <CartItemSkeleton key={i} />
      ))}
      <div className="pt-4 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-10 w-full" variant="rounded" />
      </div>
    </div>
  );
}

// Table row skeleton
function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Table skeleton
function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="py-3 px-4 text-left">
              <Skeleton className="h-4 w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  );
}

// Loading overlay
function LoadingOverlay({ message = 'Processing...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg p-6 shadow-lg flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-muted animate-spin border-t-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Spinner component
function Spinner({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    default: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-4',
  };

  return (
    <div
      className={cn(
        'rounded-full border-muted animate-spin border-t-primary',
        sizeClasses[size]
      )}
    />
  );
}

export {
  Skeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  CartItemSkeleton,
  CartSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  LoadingOverlay,
  Spinner,
};
