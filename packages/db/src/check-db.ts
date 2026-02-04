import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  console.log('Checking database...\n');

  // Check users
  const users = await sql`SELECT email, name, role, is_active FROM users`;
  console.log('Users:');
  users.forEach(u => console.log(`  - ${u.email} (${u.role}) active=${u.is_active}`));

  // Check if password works
  const [admin] = await sql`SELECT password_hash FROM users WHERE email = 'admin@demo.com'`;
  if (admin) {
    const valid = await bcrypt.compare('demo123', admin.password_hash);
    console.log(`\nPassword 'demo123' valid: ${valid}`);
    console.log(`Hash: ${admin.password_hash.substring(0, 30)}...`);
  }
}

check().catch(console.error);
