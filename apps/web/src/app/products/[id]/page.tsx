import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProduct, useCreateProduct, useUpdateProduct, useCategories } from '@/hooks/useProducts';
import { toast } from '@/components/ui/toaster';
import { PRODUCT_TYPE_LABELS } from '@pos/shared';
import type { CreateProductInput } from '@pos/shared';

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;

  const { data: product, isLoading: loadingProduct } = useProduct(isNew ? undefined : id);
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateProductInput>({
    defaultValues: {
      productType: 'general',
      costPrice: 0,
      salePrice: 0,
      stockQuantity: 0,
      minStockLevel: 5,
      unit: 'pcs',
      isActive: true,
      trackInventory: true,
      allowDiscount: true,
      taxRate: 0,
      requiresPrescription: false,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku || undefined,
        barcode: product.barcode || undefined,
        categoryId: product.categoryId || undefined,
        productType: product.productType as CreateProductInput['productType'],
        costPrice: Number(product.costPrice),
        salePrice: Number(product.salePrice),
        wholesalePrice: product.wholesalePrice ? Number(product.wholesalePrice) : undefined,
        minSalePrice: product.minSalePrice ? Number(product.minSalePrice) : undefined,
        stockQuantity: product.stockQuantity,
        minStockLevel: product.minStockLevel,
        maxStockLevel: product.maxStockLevel || undefined,
        unit: product.unit,
        brand: product.brand || undefined,
        model: product.model || undefined,
        color: product.color || undefined,
        storage: product.storage || undefined,
        ram: product.ram || undefined,
        warrantyDays: product.warrantyDays || undefined,
        genericName: product.genericName || undefined,
        manufacturer: product.manufacturer || undefined,
        strength: product.strength || undefined,
        packSize: product.packSize || undefined,
        unitsPerPack: product.unitsPerPack || undefined,
        requiresPrescription: product.requiresPrescription,
        isActive: product.isActive,
        trackInventory: product.trackInventory,
        allowDiscount: product.allowDiscount,
        taxRate: Number(product.taxRate),
        description: product.description || undefined,
        notes: product.notes || undefined,
      });
    }
  }, [product, reset]);

  const productType = watch('productType');

  const onSubmit = async (data: CreateProductInput) => {
    try {
      if (isNew) {
        await createProduct.mutateAsync(data);
        toast({ title: 'Product created successfully', variant: 'success' });
      } else {
        await updateProduct.mutateAsync({ id: id!, input: data });
        toast({ title: 'Product updated successfully', variant: 'success' });
      }
      navigate('/products');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save product',
        variant: 'destructive',
      });
    }
  };

  if (!isNew && loadingProduct) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isNew ? 'Add Product' : 'Edit Product'}</h1>
          <p className="text-muted-foreground">
            {isNew ? 'Create a new product' : `Editing ${product?.name}`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="Enter product name"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register('sku')} placeholder="Enter SKU" />
            </div>

            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...register('barcode')} placeholder="Enter barcode" />
            </div>

            <div>
              <Label htmlFor="productType">Product Type</Label>
              <Select
                value={productType}
                onValueChange={(v) => setValue('productType', v as CreateProductInput['productType'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select
                value={watch('categoryId') || '__none__'}
                onValueChange={(v) => setValue('categoryId', v === '__none__' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Category</SelectItem>
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

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="costPrice">Cost Price (PKR) *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                {...register('costPrice', { required: true, valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="salePrice">Sale Price (PKR) *</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                {...register('salePrice', { required: true, valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="wholesalePrice">Wholesale Price (PKR)</Label>
              <Input
                id="wholesalePrice"
                type="number"
                step="0.01"
                {...register('wholesalePrice', { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="minSalePrice">Minimum Sale Price (PKR)</Label>
              <Input
                id="minSalePrice"
                type="number"
                step="0.01"
                {...register('minSalePrice', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="stockQuantity">Current Stock</Label>
              <Input
                id="stockQuantity"
                type="number"
                {...register('stockQuantity', { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="minStockLevel">Minimum Stock Level</Label>
              <Input
                id="minStockLevel"
                type="number"
                {...register('minStockLevel', { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" {...register('unit')} placeholder="pcs, kg, etc." />
            </div>
          </CardContent>
        </Card>

        {/* Mobile specific fields */}
        {(productType === 'mobile_device' || productType === 'accessory') && (
          <Card>
            <CardHeader>
              <CardTitle>Mobile Product Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" {...register('brand')} placeholder="e.g., Apple, Samsung" />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" {...register('model')} placeholder="e.g., iPhone 15 Pro" />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input id="color" {...register('color')} />
              </div>
              <div>
                <Label htmlFor="storage">Storage</Label>
                <Input id="storage" {...register('storage')} placeholder="e.g., 256GB" />
              </div>
              <div>
                <Label htmlFor="warrantyDays">Warranty (Days)</Label>
                <Input
                  id="warrantyDays"
                  type="number"
                  {...register('warrantyDays', { valueAsNumber: true })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medical specific fields */}
        {(productType === 'medicine' || productType === 'medical_device') && (
          <Card>
            <CardHeader>
              <CardTitle>Medical Product Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="genericName">Generic Name</Label>
                <Input id="genericName" {...register('genericName')} />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input id="manufacturer" {...register('manufacturer')} />
              </div>
              <div>
                <Label htmlFor="strength">Strength</Label>
                <Input id="strength" {...register('strength')} placeholder="e.g., 500mg" />
              </div>
              <div>
                <Label htmlFor="packSize">Pack Size</Label>
                <Input
                  id="packSize"
                  type="number"
                  {...register('packSize', { valueAsNumber: true })}
                  placeholder="e.g., 10 tablets"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {createProduct.isPending || updateProduct.isPending ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
