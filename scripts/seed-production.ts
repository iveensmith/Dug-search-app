// Non-destructive production seed: adds demo drugs/pharmacies/admin/
// pharmacist accounts via upsert, WITHOUT touching any existing rows.
// Unlike prisma/seed.ts (local dev), this never calls deleteMany() —
// safe to run against a database that already has real registered users.
// Run with: DATABASE_URL="<pooled connection string>" npx tsx scripts/seed-production.ts
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { SEED_PASSWORD, DRUGS, PHARMACIES, inventoryFor } from '../prisma/seed-data'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  console.log('Upserting admin, pharmacist, and demo patient accounts...')
  await prisma.user.upsert({
    where: { email_role: { email: 'admin@drugfinder.test', role: 'ADMIN' } },
    update: {},
    create: { email: 'admin@drugfinder.test', passwordHash, displayName: 'Admin', role: 'ADMIN' },
  })
  await prisma.user.upsert({
    where: { email_role: { email: 'pharmacist@drugfinder.test', role: 'PHARMACIST' } },
    update: {},
    create: { email: 'pharmacist@drugfinder.test', passwordHash, displayName: 'Pharm. Idara Essien', role: 'PHARMACIST' },
  })
  await prisma.user.upsert({
    where: { email_role: { email: 'patient@drugfinder.test', role: 'PATIENT' } },
    update: {},
    create: { email: 'patient@drugfinder.test', phone: '+2348021110000', passwordHash, displayName: 'Test Patient', role: 'PATIENT' },
  })

  console.log(`Upserting ${DRUGS.length} drugs...`)
  const drugs = []
  for (const d of DRUGS) {
    drugs.push(
      await prisma.drug.upsert({
        where: { genericName_strength_form: { genericName: d.genericName, strength: d.strength, form: d.form } },
        update: { brandNames: d.brandNames },
        create: d,
      }),
    )
  }

  console.log(`Upserting ${PHARMACIES.length} pharmacies with owner accounts + inventory...`)
  for (let p = 0; p < PHARMACIES.length; p++) {
    const ph = PHARMACIES[p]
    const ownerEmail = `${ph.slug}@drugfinder.test`
    const owner = await prisma.user.upsert({
      where: { email_role: { email: ownerEmail, role: 'PHARMACY_OWNER' } },
      update: {},
      create: { email: ownerEmail, passwordHash, displayName: `${ph.name} Owner`, role: 'PHARMACY_OWNER' },
    })
    const pcnLicenseNumber = `PCN/${ph.stateAbbr}/2026/${String(p + 1).padStart(3, '0')}`
    const pharmacy = await prisma.pharmacy.upsert({
      where: { pcnLicenseNumber },
      update: {},
      create: {
        name: ph.name,
        address: ph.address,
        state: ph.state,
        latitude: ph.latitude,
        longitude: ph.longitude,
        phone: ph.phone,
        pcnLicenseNumber,
        verificationStatus: ph.verificationStatus,
        ownerUserId: owner.id,
      },
    })
    for (let d = 0; d < drugs.length; d++) {
      const { stocked, inStock } = inventoryFor(p, d)
      if (!stocked) continue
      await prisma.pharmacyInventory.upsert({
        where: { pharmacyId_drugId: { pharmacyId: pharmacy.id, drugId: drugs[d].id } },
        update: { inStock },
        create: { pharmacyId: pharmacy.id, drugId: drugs[d].id, inStock },
      })
    }
  }

  const counts = {
    users: await prisma.user.count(),
    drugs: await prisma.drug.count(),
    pharmacies: await prisma.pharmacy.count(),
    inventoryRows: await prisma.pharmacyInventory.count(),
  }
  console.log('Production seed complete (existing rows untouched):', counts)
  console.log(`All demo accounts use password "${SEED_PASSWORD}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
