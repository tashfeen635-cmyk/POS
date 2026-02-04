import { eq, and, or, ilike, sql, desc, asc, lt } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { products, categories } from '@pos/db/schema';
import type { CreateProductInput, UpdateProductInput, ProductFilterInput } from '@pos/shared';

export async function getProducts(organizationId: string, filters: ProductFilterInput) {
  const db = getDb();
  const { search, categoryId, productType, isActive, lowStock, page, limit } = filters;

  const conditions = [eq(products.organizationId, organizationId)];

  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.sku, `%${search}%`),
        ilike(products.barcode, `%${search}%`)
      )!
    );
  }

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  if (productType) {
    conditions.push(eq(products.productType, productType));
  }

  if (isActive !== undefined) {
    conditions.push(eq(products.isActive, isActive));
  }

  if (lowStock) {
    conditions.push(
      sql`${products.stockQuantity} <= ${products.minStockLevel}`
    );
  }

  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...conditions)),
  ]);

  const total = countResult[0]?.count || 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

export async function getProductById(organizationId: string, id: string) {
  const db = getDb();

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .limit(1);

  return product || null;
}

export async function getProductByBarcode(organizationId: string, barcode: string) {
  const db = getDb();

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.barcode, barcode), eq(products.organizationId, organizationId)))
    .limit(1);

  return product || null;
}

export async function createProduct(organizationId: string, input: CreateProductInput) {
  const db = getDb();

  const [product] = await db
    .insert(products)
    .values({
      organizationId,
      ...input,
      costPrice: String(input.costPrice),
      salePrice: String(input.salePrice),
      wholesalePrice: input.wholesalePrice ? String(input.wholesalePrice) : null,
      minSalePrice: input.minSalePrice ? String(input.minSalePrice) : null,
      taxRate: String(input.taxRate || 0),
    })
    .returning();

  return product;
}

export async function updateProduct(
  organizationId: string,
  id: string,
  input: UpdateProductInput
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    ...input,
    updatedAt: new Date(),
  };

  // Convert numeric fields to strings for decimal columns
  if (input.costPrice !== undefined) {
    updateData.costPrice = String(input.costPrice);
  }
  if (input.salePrice !== undefined) {
    updateData.salePrice = String(input.salePrice);
  }
  if (input.wholesalePrice !== undefined) {
    updateData.wholesalePrice = input.wholesalePrice ? String(input.wholesalePrice) : null;
  }
  if (input.minSalePrice !== undefined) {
    updateData.minSalePrice = input.minSalePrice ? String(input.minSalePrice) : null;
  }
  if (input.taxRate !== undefined) {
    updateData.taxRate = String(input.taxRate);
  }

  const [product] = await db
    .update(products)
    .set(updateData)
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  return product || null;
}

export async function deleteProduct(organizationId: string, id: string) {
  const db = getDb();

  // Soft delete by setting isActive to false
  const [product] = await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  return product || null;
}

// Categories
export async function getCategories(organizationId: string) {
  const db = getDb();

  return db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(asc(categories.name));
}

export async function createCategory(
  organizationId: string,
  input: { name: string; parentId?: string | null; description?: string | null }
) {
  const db = getDb();

  const [category] = await db
    .insert(categories)
    .values({
      organizationId,
      name: input.name,
      parentId: input.parentId || null,
      description: input.description || null,
    })
    .returning();

  return category;
}

export async function updateCategory(
  organizationId: string,
  id: string,
  input: { name?: string; parentId?: string | null; description?: string | null; isActive?: boolean }
) {
  const db = getDb();

  const [category] = await db
    .update(categories)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
    .returning();

  return category || null;
}

export async function deleteCategory(organizationId: string, id: string) {
  const db = getDb();

  // First, unlink products from this category
  await db
    .update(products)
    .set({ categoryId: null, updatedAt: new Date() })
    .where(and(eq(products.categoryId, id), eq(products.organizationId, organizationId)));

  // Then delete the category
  const [category] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
    .returning();

  return category || null;
}

export async function getLowStockProducts(organizationId: string, limit = 10) {
  const db = getDb();

  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(products.trackInventory, true),
        sql`${products.stockQuantity} <= ${products.minStockLevel}`
      )
    )
    .orderBy(asc(sql`${products.stockQuantity} - ${products.minStockLevel}`))
    .limit(limit);
}
