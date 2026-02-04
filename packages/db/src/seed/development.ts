import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import bcrypt from 'bcryptjs';
import * as schema from '../schema';

// Seed data for development
async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log('Starting database seeding...');

  // Hash password and PIN
  const passwordHash = await bcrypt.hash('demo123', 10);
  const pinHash = await bcrypt.hash('1234', 10);

  // Create organization
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: 'Demo Mobile Shop',
      email: 'demo@posystem.com',
      phone: '+92-300-1234567',
      address: 'Shop #1, Main Market',
      city: 'Karachi',
      storeType: 'mobile_shop',
      settings: {
        currency: 'PKR',
        locale: 'en-PK',
        taxRate: 0,
        receiptHeader: 'Welcome to Demo Mobile Shop',
        receiptFooter: 'Thank you for your purchase!',
        lowStockThreshold: 5,
        expiryAlertDays: 90,
      },
    })
    .returning();

  console.log('Created organization:', org.name);

  // Create store
  const [store] = await db
    .insert(schema.stores)
    .values({
      organizationId: org.id,
      name: 'Main Store',
      code: 'MAIN',
      address: 'Shop #1, Main Market',
      phone: '+92-300-1234567',
    })
    .returning();

  console.log('Created store:', store.name);

  // Create admin user (password: demo123, PIN: 1234)
  const [adminUser] = await db
    .insert(schema.users)
    .values({
      organizationId: org.id,
      storeId: store.id,
      email: 'admin@demo.com',
      passwordHash,
      pinHash,
      name: 'Admin User',
      phone: '+92-300-1234567',
      role: 'admin',
    })
    .returning();

  console.log('Created admin user:', adminUser.email);

  // Create cashier user
  const [cashierUser] = await db
    .insert(schema.users)
    .values({
      organizationId: org.id,
      storeId: store.id,
      email: 'cashier@demo.com',
      passwordHash,
      pinHash,
      name: 'Cashier User',
      phone: '+92-301-1234567',
      role: 'cashier',
    })
    .returning();

  console.log('Created cashier user:', cashierUser.email);

  // Create categories
  const [mobileCategory] = await db
    .insert(schema.categories)
    .values({
      organizationId: org.id,
      name: 'Mobile Phones',
      description: 'Smartphones and feature phones',
    })
    .returning();

  const [accessoryCategory] = await db
    .insert(schema.categories)
    .values({
      organizationId: org.id,
      name: 'Accessories',
      description: 'Phone accessories and gadgets',
    })
    .returning();

  console.log('Created categories');

  // Create products
  const products = await db
    .insert(schema.products)
    .values([
      {
        organizationId: org.id,
        categoryId: mobileCategory.id,
        name: 'iPhone 15 Pro Max 256GB',
        sku: 'IPH15PM256',
        barcode: '194253938545',
        productType: 'mobile_device',
        costPrice: '450000',
        salePrice: '520000',
        minSalePrice: '500000',
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        storage: '256GB',
        warrantyDays: 365,
        stockQuantity: 0, // Stock managed via IMEI
        minStockLevel: 3,
        trackInventory: true,
      },
      {
        organizationId: org.id,
        categoryId: mobileCategory.id,
        name: 'Samsung Galaxy S24 Ultra 256GB',
        sku: 'SAMS24U256',
        barcode: '887276789019',
        productType: 'mobile_device',
        costPrice: '380000',
        salePrice: '430000',
        minSalePrice: '410000',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        storage: '256GB',
        warrantyDays: 365,
        stockQuantity: 0,
        minStockLevel: 3,
        trackInventory: true,
      },
      {
        organizationId: org.id,
        categoryId: accessoryCategory.id,
        name: 'Apple 20W USB-C Power Adapter',
        sku: 'APL20WADP',
        barcode: '194252157855',
        productType: 'accessory',
        costPrice: '4000',
        salePrice: '6500',
        minSalePrice: '5500',
        brand: 'Apple',
        stockQuantity: 50,
        minStockLevel: 10,
        trackInventory: true,
      },
      {
        organizationId: org.id,
        categoryId: accessoryCategory.id,
        name: 'Tempered Glass Screen Protector',
        sku: 'TEMPGLASS',
        productType: 'accessory',
        costPrice: '100',
        salePrice: '500',
        minSalePrice: '300',
        stockQuantity: 200,
        minStockLevel: 50,
        trackInventory: true,
      },
      {
        organizationId: org.id,
        categoryId: accessoryCategory.id,
        name: 'Phone Case - Clear TPU',
        sku: 'CASETP001',
        productType: 'accessory',
        costPrice: '150',
        salePrice: '600',
        minSalePrice: '400',
        stockQuantity: 100,
        minStockLevel: 20,
        trackInventory: true,
      },
    ])
    .returning();

  console.log('Created', products.length, 'products');

  // Create IMEI inventory for mobile devices
  const iphone = products.find((p) => p.sku === 'IPH15PM256');
  const samsung = products.find((p) => p.sku === 'SAMS24U256');

  if (iphone) {
    await db.insert(schema.imeiInventory).values([
      {
        organizationId: org.id,
        storeId: store.id,
        productId: iphone.id,
        imei1: '356789012345678',
        imei2: '356789012345679',
        costPrice: '450000',
        salePrice: '520000',
        color: 'Natural Titanium',
        storage: '256GB',
        condition: 'new',
      },
      {
        organizationId: org.id,
        storeId: store.id,
        productId: iphone.id,
        imei1: '356789012345680',
        imei2: '356789012345681',
        costPrice: '450000',
        salePrice: '520000',
        color: 'Black Titanium',
        storage: '256GB',
        condition: 'new',
      },
    ]);
  }

  if (samsung) {
    await db.insert(schema.imeiInventory).values([
      {
        organizationId: org.id,
        storeId: store.id,
        productId: samsung.id,
        imei1: '352789012345678',
        costPrice: '380000',
        salePrice: '430000',
        color: 'Titanium Black',
        storage: '256GB',
        condition: 'new',
      },
    ]);
  }

  console.log('Created IMEI inventory');

  // Create customers
  await db.insert(schema.customers).values([
    {
      organizationId: org.id,
      name: 'Ahmed Khan',
      phone: '+92-321-1234567',
      email: 'ahmed.khan@example.com',
      cnic: '4220112345678',
      address: 'Block 5, Gulshan-e-Iqbal',
      city: 'Karachi',
      creditLimit: '50000',
    },
    {
      organizationId: org.id,
      name: 'Fatima Ali',
      phone: '+92-333-9876543',
      address: 'DHA Phase 5',
      city: 'Karachi',
      creditLimit: '100000',
    },
    {
      organizationId: org.id,
      name: 'Walk-in Customer',
      phone: null,
      creditLimit: '0',
    },
  ]);

  console.log('Created customers');

  console.log('Seeding completed successfully!');
  console.log('\nDemo credentials:');
  console.log('  Email: admin@demo.com');
  console.log('  Password: demo123');
  console.log('  PIN: 1234');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
