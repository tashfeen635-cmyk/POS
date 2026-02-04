import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/utils/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    categoryId: categoryId || undefined,
    page: 1,
    limit: 50,
  });

  const { data: categories } = useCategories();

  const products = productsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : products.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} to={`/products/${product.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{product.sku || 'No SKU'}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-lg font-bold">
                        {formatCurrency(parseFloat(product.salePrice))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Cost: {formatCurrency(parseFloat(product.costPrice))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          product.stockQuantity <= product.minStockLevel
                            ? 'text-destructive'
                            : 'text-success'
                        }`}
                      >
                        {product.stockQuantity} in stock
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No products found</p>
            <Button asChild>
              <Link to="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add your first product
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
