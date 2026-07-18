# Deploying PharmaFinder (free tier: Vercel + Supabase)

The app runs on Next.js API routes with no persistent local state, except
the database and prescription-image storage — both of which need to move
off this machine's portable Postgres/local disk before deploying.

## 1. Create a Supabase project (free tier)

1. Go to supabase.com and create a project (pick a region close to Nigeria,
   e.g. `eu-west` or `ap-southeast`, for lower latency).
2. **Database → Connect** in the dashboard gives you two connection
   strings — copy both:
   - **Transaction pooler** (port 6543) → this is `DATABASE_URL`
   - **Direct connection** (port 5432) → this is `DIRECT_URL`
3. **Storage** → create a new bucket named `prescriptions`, set it to
   **Private** (not public — prescription photos are medical data and must
   only be served through our access-checked API route).
4. **Project Settings → API** → copy the **service_role** key (not the
   `anon` key — the service role key is what lets the server upload/download
   without per-user Storage policies). Copy the **Project URL** too.

## 2. Push the schema to Supabase

From this machine, with the values from step 1:

```bash
DATABASE_URL="<pooled connection string>" DIRECT_URL="<direct connection string>" npx prisma migrate deploy
```

Optional — seed it with the demo pharmacies/drugs so the deployed app isn't
empty:

```bash
DATABASE_URL="<pooled connection string>" npm run db:seed
```

## 3. Create a Vercel project

1. Go to vercel.com, sign in with GitHub, **Add New → Project**, and import
   `iveensmith/Dug-search-app`. Vercel auto-detects Next.js — no build
   command changes needed (it picks up the `vercel-build` script in
   `package.json` automatically, which runs migrations then builds).
2. Before the first deploy, add these **Environment Variables** (Project
   Settings → Environment Variables), all scoped to Production (and Preview,
   if you want preview deploys to work too):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the pooled (port 6543) Supabase connection string |
   | `DIRECT_URL` | the direct (port 5432) Supabase connection string |
   | `JWT_SECRET` | a fresh random value — generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output in. **Do not reuse the local dev secret.** |
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 1 |
   | `SUPABASE_STORAGE_BUCKET` | `prescriptions` |

3. Deploy. Vercel gives you a `*.vercel.app` URL immediately; a custom
   domain can be added later under Project Settings → Domains (also free).

## What's already handled in code

- `src/lib/storage.ts` automatically switches from local disk to Supabase
  Storage when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
  `SUPABASE_STORAGE_BUCKET` are set — nothing else to change, local dev is
  unaffected since those vars stay unset in `.env`.
- `prisma.config.ts` uses `DIRECT_URL` for migrations (falls back to
  `DATABASE_URL` locally, where there's no pooler to worry about).
- `package.json`'s `vercel-build` script runs `prisma migrate deploy`
  automatically on every deploy, so schema changes you push to `master`
  roll out without a manual step.

## After deploying

- Re-run through the account checklist in the README (admin/pharmacist/
  patient test logins) against the live URL to confirm everything works
  end-to-end in production, not just locally.
- The OSRM routing demo server (`router.project-osrm.org`) has no uptime
  guarantee — fine to leave as-is for a demo, but plan to point `OSRM_URL`
  at a self-hosted instance before real users depend on it.
- Supabase's free tier pauses a project after a week of no API/DB
  activity — the first request after a pause takes a few extra seconds to
  wake it up. Fine for a demo; worth knowing.
