# POS System

A modern, offline-first Point of Sale system for mobile shops and medical stores with cloud sync capabilities.

## Tech Stack

- **Frontend**: React 19 + Vite 6 + TypeScript
- **Routing**: React Router v7
- **UI**: shadcn/ui + Tailwind CSS 4
- **State**: Zustand + TanStack Query
- **Offline DB**: Dexie.js (IndexedDB)
- **Backend**: Hono.js + TypeScript
- **ORM**: Drizzle ORM
- **Database**: Neon PostgreSQL
- **Validation**: Zod
- **Auth**: JWT with refresh tokens
- **Package Manager**: pnpm
- **Monorepo**: Turborepo

## Locale Settings

- **Currency**: PKR (Pakistani Rupee)
- **Locale**: en-PK
- **Number Format**: 1,23,456.00 (South Asian)
- **Date Format**: DD/MM/YYYY

## Project Structure

```
pos-system/
├── apps/
│   └── web/              # Main POS PWA
├── packages/
│   ├── api/              # Backend API (Hono.js)
│   ├── db/               # Database schema & migrations
│   └── shared/           # Shared types & validation
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or Neon account)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate database migrations
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed development data
pnpm db:seed
```

### Development

```bash
# Start all services
pnpm dev

# Start specific app
pnpm --filter @pos/web dev
pnpm --filter @pos/api dev
```

### Build

```bash
pnpm build
```

## Demo Credentials

- **Email**: admin@demo.com
- **Password**: demo123
- **PIN**: 1234

## Features

### Core
- Multi-tenant architecture
- Offline-first with background sync
- PWA support
- Real-time inventory tracking

### Mobile Shop
- IMEI tracking for devices
- Trade-in management
- Warranty tracking
- Repair order management

### Medical Store
- Batch/lot tracking with expiry
- FEFO (First Expiry First Out)
- Prescription tracking
- Expiry alerts

### POS
- Barcode scanning
- Multi-payment support (Cash, Card, UPI, Credit)
- Receipt printing
- Customer management
- Credit (Udhaar) tracking

## License

Private - All rights reserved
