<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# New tables need RLS

Supabase serves every table in `public` over PostgREST using the anon key,
which is public by design. A table there with row-level security off is
readable and writable by anyone holding that key.

This app never uses PostgREST — Prisma connects directly as the table
owner, and an owner bypasses RLS — so every table should be created with:

```sql
ALTER TABLE "NewTable" ENABLE ROW LEVEL SECURITY;
```

No policies, and never `FORCE ROW LEVEL SECURITY`: forcing applies RLS to
the owner too, which would lock the app out of its own database.

Six tables were left open this way before anyone noticed (see migration
20260809210000). Add the line in the same migration that creates the table.
