# DrugFinder Uyo

MVP web app for Uyo, Nigeria: patients search for a drug and see which nearby
pharmacies have it in stock (with map + directions); pharmacies manage their own
inventory after admin approval; patients can upload a prescription photo and
chat with a licensed pharmacist about it.

## Stack

Next.js 16 (App Router) · TailwindCSS · Prisma 7 · PostgreSQL 17 (portable, in
`pgsql/`) · Leaflet + OpenStreetMap · OSRM (free in-app routing) · bcryptjs +
JWT cookie auth

## Local setup

Everything is self-contained — the Postgres runtime lives in `pgsql/` (ignored
by git) with its data in `pgdata/`. No Docker, no system install.

```bash
npm install
npm run db:start      # start local Postgres (needed before dev/migrate/seed)
npx prisma migrate dev
npm run db:seed       # 10 Uyo pharmacies, 30 drugs, test accounts
npm run dev           # http://localhost:3000
```

Stop the database with `npm run db:stop`, check it with `npm run db:status`.

**Testing on a phone:** browsers only allow geolocation on HTTPS or localhost.
To test location-aware search/directions from a phone on your LAN, run
`npm run dev:https` and open `https://<your-PC-IP>:3000` (accept the
self-signed certificate warning). Plain `http://<IP>:3000` will always fall
back to Uyo city centre because the browser blocks location on insecure
origins.

## Test accounts (all use password `password123`)

| Role           | Login                                                    |
| -------------- | -------------------------------------------------------- |
| Admin          | `admin@drugfinder.test`                                   |
| Pharmacist     | `pharmacist@drugfinder.test`                              |
| Patient        | `patient@drugfinder.test`                                 |
| Pharmacy owner | `mercyland@drugfinder.test` (also: gracecare, uduak, lifespring, firstchoice, vinebranch, rehoboth, citymed, goodness, emem) |

Seed notes: `goodness` is PENDING and `emem` is REJECTED (for testing the
approval gate); Insulin Glargine is stocked by no pharmacy (for testing
zero-result searches); Paracetamol 500 mg is in stock everywhere.

## Trying each feature

- **Patient search** — open `/`, search "panadol" or "flagyl" (brand names work),
  toggle List/Map, tap Directions (draws the route + drive time on the in-app
  map — no Google account needed; a "Voice navigation" link hands off to Google
  Maps for turn-by-turn) or Call. Insulin Glargine demonstrates the zero-results
  state. Routing uses OSRM's free demo server; set `OSRM_URL` to a self-hosted
  instance before real launch.
- **Pharmacy dashboard** — log in as `mercyland@drugfinder.test` → `/pharmacy`:
  toggle stock, search-and-add drugs from the master list. `goodness@…` shows
  the awaiting-approval state.
- **Pharmacy registration** — `/pharmacy/register`: geocode button + draggable
  map pin; new registrations land as PENDING.
- **Admin** — log in as `admin@drugfinder.test` → `/admin`: approve/reject
  pharmacies, add/edit drugs, and see search-gap analytics.
- **Prescription chat** — as `patient@drugfinder.test`, upload a photo at
  `/prescriptions`; as `pharmacist@drugfinder.test`, claim it at `/pharmacist`
  and reply. Unread badges act as in-app notifications.

Prescription images are stored on local disk under `storage/uploads` behind a
swappable adapter ([storage.ts](src/lib/storage.ts)) and served only through an
access-checked API route (never from `/public`).

`npm run verify:phase1` re-checks the data foundation (seed integrity, Haversine
distance search, approval gating, stock-toggle round trip).

## Phase status

1. ✅ Data foundation + seed
2. ✅ Patient drug search (no login)
3. ✅ Pharmacy registration + inventory dashboard
4. ✅ Admin panel
5. ✅ Prescription upload + pharmacist chat
