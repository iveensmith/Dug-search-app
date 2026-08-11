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
# Trigram indexes need the schema now

pg_trgm lives in the `extensions` schema, not `public` — Supabase's
Security Advisor flags extensions in `public`, because that schema is on
everyone's search_path and an object planted there can be resolved ahead
of the one a query meant (see migration 20260811100000).

The cost is that `gin_trgm_ops` no longer resolves on its own. A new
trigram index must name the schema:

```sql
CREATE INDEX "Thing_name_trgm_idx"
  ON "Thing" USING gin ("name" extensions.gin_trgm_ops);
```

Without the prefix the migration fails with `operator class
"gin_trgm_ops" does not exist for access method "gin"`. The same applies
to `similarity()`, `%` and `<->` if SQL ever calls them — today nothing
does; the searches use ILIKE, which the trigram indexes accelerate
without naming anything.
