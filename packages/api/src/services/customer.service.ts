import { eq, and, or, ilike, sql, desc, gt } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { customers } from '@pos/db/schema';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerFilterInput } from '@pos/shared';

export async function getCustomers(organizationId: string, filters: CustomerFilterInput) {
  const db = getDb();
  const { search, hasCredit, isActive, page, limit } = filters;

  const conditions = [eq(customers.organizationId, organizationId)];

  if (search) {
    conditions.push(
      or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.email, `%${search}%`)
      )!
    );
  }

  if (hasCredit !== undefined) {
    if (hasCredit) {
      conditions.push(gt(customers.currentBalance, '0'));
    } else {
      conditions.push(sql`${customers.currentBalance} <= 0`);
    }
  }

  if (isActive !== undefined) {
    conditions.push(eq(customers.isActive, isActive));
  }

  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
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

export async function getCustomerById(organizationId: string, id: string) {
  const db = getDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .limit(1);

  return customer || null;
}

export async function getCustomerByPhone(organizationId: string, phone: string) {
  const db = getDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.phone, phone), eq(customers.organizationId, organizationId)))
    .limit(1);

  return customer || null;
}

export async function createCustomer(organizationId: string, input: CreateCustomerInput) {
  const db = getDb();

  const [customer] = await db
    .insert(customers)
    .values({
      organizationId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      cnic: input.cnic || null,
      address: input.address || null,
      city: input.city || null,
      creditLimit: String(input.creditLimit || 0),
      notes: input.notes || null,
      isActive: input.isActive ?? true,
    })
    .returning();

  return customer;
}

export async function updateCustomer(
  organizationId: string,
  id: string,
  input: UpdateCustomerInput
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.creditLimit !== undefined) {
    updateData.creditLimit = String(input.creditLimit);
  }

  const [customer] = await db
    .update(customers)
    .set(updateData)
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .returning();

  return customer || null;
}

export async function deleteCustomer(organizationId: string, id: string) {
  const db = getDb();

  // Soft delete
  const [customer] = await db
    .update(customers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .returning();

  return customer || null;
}

export async function updateCustomerBalance(
  organizationId: string,
  id: string,
  amount: number,
  type: 'purchase' | 'payment'
) {
  const db = getDb();

  if (type === 'purchase') {
    await db
      .update(customers)
      .set({
        currentBalance: sql`${customers.currentBalance} + ${amount}`,
        totalPurchases: sql`${customers.totalPurchases} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
  } else {
    await db
      .update(customers)
      .set({
        currentBalance: sql`${customers.currentBalance} - ${amount}`,
        totalPaid: sql`${customers.totalPaid} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
  }
}

export async function getCustomersWithCredit(organizationId: string) {
  const db = getDb();

  return db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true),
        gt(customers.currentBalance, '0')
      )
    )
    .orderBy(desc(customers.currentBalance));
}
