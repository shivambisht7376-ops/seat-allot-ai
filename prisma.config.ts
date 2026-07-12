import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Explicitly load .env so env vars are available when Prisma CLI reads this config.
dotenv.config();

// DATABASE_URL         — pooled connection (pgBouncer) used by the app at runtime.
// DATABASE_URL_UNPOOLED — direct connection used by Prisma Migrate.
//   Neon's pgBouncer runs in statement mode, which is incompatible with migrations.
// Both values come from .env — never hardcoded.

const migrateUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;

export default defineConfig({
  // @ts-ignore — earlyAccess is required for the driver adapter API (Prisma v6 Early Access)
  earlyAccess: true,
  schema: './prisma/schema.prisma',

  datasource: {
    url: migrateUrl,
  },

  migrate: {
    async adapter() {
      const pool = new Pool({ connectionString: migrateUrl });
      return new PrismaPg(pool, { schema: 'public' });
    },
  },
});


