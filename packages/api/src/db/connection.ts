import { createDb, type Database } from '@pos/db';

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    db = createDb(databaseUrl);
  }
  return db;
}
