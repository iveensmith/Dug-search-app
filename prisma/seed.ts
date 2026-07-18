import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { SEED_PASSWORD, DRUGS, PHARMACIES, inventoryFor } from './seed-data'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  console.log('Clearing existing data...')
  await prisma.prescriptionMessage.deleteMany()
  await prisma.prescriptionUpload.deleteMany()
  await prisma.searchLog.deleteMany()
  await prisma.pharmacyInventory.deleteMany()
  await prisma.pharmacy.deleteMany()
  await prisma.user.deleteMany()
  await prisma.drug.deleteMany()

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  console.log('Creating admin, pharmacist, and patient accounts...')
  await prisma.user.create({
    data: { email: 'admin@drugfinder.test', passwordHash, displayName: 'Admin', role: 'ADMIN' },
  })
  await prisma.user.create({
    data: { email: 'pharmacist@drugfinder.test', passwordHash, displayName: 'Pharm. Idara Essien', role: 'PHARMACIST' },
  })
  await prisma.user.create({
    data: { email: 'patient@drugfinder.test', phone: '+2348021110000', passwordHash, displayName: 'Test Patient', role: 'PATIENT' },
  })

  console.log(`Creating ${DRUGS.length} drugs...`)
  const drugs = []
  for (const d of DRUGS) {
    drugs.push(await prisma.drug.create({ data: d }))
  }

  console.log(`Creating ${PHARMACIES.length} pharmacies with owner accounts + inventory...`)
  for (let p = 0; p < PHARMACIES.length; p++) {
    const ph = PHARMACIES[p]
    const owner = await prisma.user.create({
      data: {
        email: `${ph.slug}@drugfinder.test`,
        passwordHash,
        displayName: `${ph.name} Owner`,
        role: 'PHARMACY_OWNER',
      },
    })
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: ph.name,
        address: ph.address,
        state: ph.state,
        latitude: ph.latitude,
        longitude: ph.longitude,
        phone: ph.phone,
        pcnLicenseNumber: `PCN/${ph.stateAbbr}/2026/${String(p + 1).padStart(3, '0')}`,
        verificationStatus: ph.verificationStatus,
        ownerUserId: owner.id,
      },
    })
    const rows = []
    for (let d = 0; d < drugs.length; d++) {
      const { stocked, inStock } = inventoryFor(p, d)
      if (stocked) rows.push({ pharmacyId: pharmacy.id, drugId: drugs[d].id, inStock })
    }
    await prisma.pharmacyInventory.createMany({ data: rows })
  }

  const counts = {
    users: await prisma.user.count(),
    drugs: await prisma.drug.count(),
    pharmacies: await prisma.pharmacy.count(),
    inventoryRows: await prisma.pharmacyInventory.count(),
  }
  console.log('Seed complete:', counts)
  console.log(`All seed accounts use password "${SEED_PASSWORD}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
