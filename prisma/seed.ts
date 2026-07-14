import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'
import type { DrugForm, VerificationStatus } from '../src/generated/prisma/enums'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

// All seed accounts share this password (dev only)
const SEED_PASSWORD = 'password123'

type DrugSeed = {
  genericName: string
  brandNames: string[]
  strength: string
  form: DrugForm
}

// ~30 drugs commonly dispensed in Nigeria. The last entry (insulin) is
// deliberately stocked by NO pharmacy so zero-result searches are testable.
const DRUGS: DrugSeed[] = [
  { genericName: 'Paracetamol', brandNames: ['Panadol', 'Emzor Paracetamol'], strength: '500 mg', form: 'TABLET' },
  { genericName: 'Paracetamol', brandNames: ['Calpol'], strength: '125 mg/5 ml', form: 'SYRUP' },
  { genericName: 'Ibuprofen', brandNames: ['Brufen', 'Advil'], strength: '400 mg', form: 'TABLET' },
  { genericName: 'Diclofenac', brandNames: ['Voltaren', 'Cataflam'], strength: '50 mg', form: 'TABLET' },
  { genericName: 'Artemether/Lumefantrine', brandNames: ['Coartem', 'Lonart', 'Amatem'], strength: '20/120 mg', form: 'TABLET' },
  { genericName: 'Artemether/Lumefantrine', brandNames: ['Lonart Suspension'], strength: '15/90 mg per 5 ml', form: 'SUSPENSION' },
  { genericName: 'Amoxicillin', brandNames: ['Amoxil'], strength: '500 mg', form: 'CAPSULE' },
  { genericName: 'Amoxicillin', brandNames: ['Amoxil Syrup'], strength: '125 mg/5 ml', form: 'SUSPENSION' },
  { genericName: 'Amoxicillin/Clavulanate', brandNames: ['Augmentin'], strength: '625 mg', form: 'TABLET' },
  { genericName: 'Ciprofloxacin', brandNames: ['Ciprotab', 'Ciproxin'], strength: '500 mg', form: 'TABLET' },
  { genericName: 'Azithromycin', brandNames: ['Zithromax'], strength: '500 mg', form: 'TABLET' },
  { genericName: 'Metronidazole', brandNames: ['Flagyl'], strength: '400 mg', form: 'TABLET' },
  { genericName: 'Cefuroxime', brandNames: ['Zinnat'], strength: '500 mg', form: 'TABLET' },
  { genericName: 'Metformin', brandNames: ['Glucophage'], strength: '500 mg', form: 'TABLET' },
  { genericName: 'Glibenclamide', brandNames: ['Daonil'], strength: '5 mg', form: 'TABLET' },
  { genericName: 'Amlodipine', brandNames: ['Norvasc'], strength: '5 mg', form: 'TABLET' },
  { genericName: 'Lisinopril', brandNames: ['Zestril'], strength: '10 mg', form: 'TABLET' },
  { genericName: 'Losartan', brandNames: ['Cozaar'], strength: '50 mg', form: 'TABLET' },
  { genericName: 'Nifedipine', brandNames: ['Adalat'], strength: '20 mg', form: 'TABLET' },
  { genericName: 'Omeprazole', brandNames: ['Losec', 'Meprasil'], strength: '20 mg', form: 'CAPSULE' },
  { genericName: 'Hyoscine Butylbromide', brandNames: ['Buscopan'], strength: '10 mg', form: 'TABLET' },
  { genericName: 'Loratadine', brandNames: ['Claritin'], strength: '10 mg', form: 'TABLET' },
  { genericName: 'Cetirizine', brandNames: ['Zyrtec'], strength: '10 mg', form: 'TABLET' },
  { genericName: 'Chlorpheniramine', brandNames: ['Piriton'], strength: '4 mg', form: 'TABLET' },
  { genericName: 'Salbutamol', brandNames: ['Ventolin'], strength: '100 mcg/dose', form: 'INHALER' },
  { genericName: 'Prednisolone', brandNames: ['Deltacortril'], strength: '5 mg', form: 'TABLET' },
  { genericName: 'Zinc Sulphate', brandNames: ['Zinkid'], strength: '20 mg', form: 'TABLET' },
  { genericName: 'Oral Rehydration Salts', brandNames: ['ORS'], strength: '20.5 g sachet', form: 'OTHER' },
  { genericName: 'Ferrous Sulphate', brandNames: ['Fesolate'], strength: '200 mg', form: 'TABLET' },
  { genericName: 'Insulin Glargine', brandNames: ['Lantus'], strength: '100 IU/ml', form: 'INJECTION' },
]
const ORPHAN_DRUG_INDEX = DRUGS.length - 1 // insulin — no stock anywhere

type PharmacySeed = {
  name: string
  slug: string
  address: string
  latitude: number
  longitude: number
  phone: string
  verificationStatus: VerificationStatus
}

// Fake pharmacies spread across real Uyo neighborhoods/roads.
// Coordinates are approximate points within Uyo (center ~5.038N, 7.914E).
const PHARMACIES: PharmacySeed[] = [
  { name: 'Mercyland Pharmacy', slug: 'mercyland', address: '12 Ibom Plaza Road, Uyo', latitude: 5.0407, longitude: 7.9204, phone: '+234 803 111 0001', verificationStatus: 'APPROVED' },
  { name: 'GraceCare Pharmacy', slug: 'gracecare', address: '45 Ikot Ekpene Road, Itam, Uyo', latitude: 5.0585, longitude: 7.8892, phone: '+234 803 111 0002', verificationStatus: 'APPROVED' },
  { name: 'Uduak Pharmacy & Stores', slug: 'uduak', address: '23 Abak Road, Uyo', latitude: 5.0281, longitude: 7.8973, phone: '+234 803 111 0003', verificationStatus: 'APPROVED' },
  { name: 'LifeSpring Pharmacy', slug: 'lifespring', address: '87 Oron Road, Uyo', latitude: 5.0173, longitude: 7.9256, phone: '+234 803 111 0004', verificationStatus: 'APPROVED' },
  { name: 'First Choice Pharmacy', slug: 'firstchoice', address: '15 Aka Road, Uyo', latitude: 5.0224, longitude: 7.9089, phone: '+234 803 111 0005', verificationStatus: 'APPROVED' },
  { name: 'Vine Branch Pharmacy', slug: 'vinebranch', address: '3 Ewet Housing Estate Road, Uyo', latitude: 5.0182, longitude: 7.9418, phone: '+234 803 111 0006', verificationStatus: 'APPROVED' },
  { name: 'Rehoboth Pharmacy', slug: 'rehoboth', address: '118 Nwaniba Road, Uyo', latitude: 5.0246, longitude: 7.9553, phone: '+234 803 111 0007', verificationStatus: 'APPROVED' },
  { name: 'CityMed Pharmacy', slug: 'citymed', address: '9 Udo Udoma Avenue, Uyo', latitude: 5.0348, longitude: 7.9302, phone: '+234 803 111 0008', verificationStatus: 'APPROVED' },
  { name: 'Goodness Pharmacy', slug: 'goodness', address: '52 Ikpa Road, Uyo', latitude: 5.0479, longitude: 7.9058, phone: '+234 803 111 0009', verificationStatus: 'PENDING' },
  { name: 'Emem Pharmacy', slug: 'emem', address: '31 Wellington Bassey Way, Uyo', latitude: 5.0396, longitude: 7.9147, phone: '+234 803 111 0010', verificationStatus: 'REJECTED' },
]

// Deterministic pseudo-random inventory so seeding is reproducible:
// ~60% of drugs stocked per pharmacy, ~80% of stocked entries in stock.
// Paracetamol 500 mg (index 0) is always in stock everywhere; the orphan
// drug (insulin) is stocked nowhere.
function inventoryFor(pharmacyIdx: number, drugIdx: number): { stocked: boolean; inStock: boolean } {
  if (drugIdx === ORPHAN_DRUG_INDEX) return { stocked: false, inStock: false }
  if (drugIdx === 0) return { stocked: true, inStock: true }
  const stocked = (pharmacyIdx * 7 + drugIdx * 11) % 30 < 18
  const inStock = (pharmacyIdx + drugIdx) % 5 !== 0
  return { stocked, inStock }
}

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
        latitude: ph.latitude,
        longitude: ph.longitude,
        phone: ph.phone,
        pcnLicenseNumber: `PCN/AKS/UYO/2026/${String(p + 1).padStart(3, '0')}`,
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
