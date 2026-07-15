import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Migrate/introspect need a direct (non-pooled) connection — pooled
// connections (e.g. Supabase's pgbouncer on port 6543) don't support the
// prepared statements DDL migrations rely on. DIRECT_URL is only set in
// production; locally there's no pooler, so DATABASE_URL covers both.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
