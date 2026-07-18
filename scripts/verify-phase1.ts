// Phase 1 end-to-end verification: seed data present, distance query
// correct, approval gating enforced, stock toggle reflected in search,
// state scoping keeps results within the searched state.
// Run with: npm run verify:phase1
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { findPharmaciesWithDrug } from '../src/lib/geo'

const IBOM_PLAZA = { lat: 5.0407, lng: 7.9204 } // Uyo, Akwa Ibom
const IKEJA = { lat: 6.6018, lng: 3.3515 } // Lagos

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function main() {
  // 1. Seed data present
  const [users, drugs, pharmacies, inventory] = await Promise.all([
    prisma.user.count(),
    prisma.drug.count(),
    prisma.pharmacy.count(),
    prisma.pharmacyInventory.count(),
  ])
  console.log(`Counts: users=${users} drugs=${drugs} pharmacies=${pharmacies} inventory=${inventory}\n`)
  check('seed counts', users === 15 && drugs === 30 && pharmacies === 12 && inventory > 100)

  // 2. Search: Paracetamol 500 mg in Akwa Ibom — every approved AK pharmacy stocks it
  const paracetamol = await prisma.drug.findFirst({
    where: { genericName: 'Paracetamol', form: 'TABLET' },
  })
  if (!paracetamol) throw new Error('Paracetamol seed row missing')

  const results = await findPharmaciesWithDrug({
    drugId: paracetamol.id,
    state: 'AKWA_IBOM',
    ...IBOM_PLAZA,
  })
  console.log(`\nParacetamol 500 mg in Akwa Ibom: ${results.length} pharmacies`)
  for (const r of results) {
    console.log(`  ${r.distanceKm.toFixed(2).padStart(5)} km  ${r.name} — ${r.address} (${r.phone})`)
  }
  check('all 8 approved Akwa Ibom pharmacies found', results.length === 8)

  const sorted = results.every((r, i) => i === 0 || r.distanceKm >= results[i - 1].distanceKm)
  check('results sorted nearest-first', sorted)

  const closest = results[0]
  check(
    'nearest result is the city-centre pharmacy',
    closest?.name === 'Mercyland Pharmacy',
    `nearest = ${closest?.name} at ${closest?.distanceKm.toFixed(3)} km`,
  )

  // 3. Approval gating: pending/rejected pharmacies never appear
  const names = results.map((r) => r.name)
  check(
    'PENDING pharmacy (Goodness) excluded',
    !names.includes('Goodness Pharmacy'),
  )
  check(
    'REJECTED pharmacy (Emem) excluded',
    !names.includes('Emem Pharmacy'),
  )

  // 4. Zero-result search: orphan drug stocked nowhere
  const insulin = await prisma.drug.findFirst({ where: { genericName: 'Insulin Glargine' } })
  if (!insulin) throw new Error('Insulin seed row missing')
  const noResults = await findPharmaciesWithDrug({ drugId: insulin.id, state: 'AKWA_IBOM', ...IBOM_PLAZA })
  check('orphan drug returns zero results', noResults.length === 0)

  // 5. State scoping: a Lagos search never returns Akwa Ibom pharmacies, and vice versa
  const lagosResults = await findPharmaciesWithDrug({ drugId: paracetamol.id, state: 'LAGOS', ...IKEJA })
  check('Lagos search returns only Lagos pharmacies', lagosResults.length === 2)
  check(
    'Akwa Ibom pharmacies never leak into a Lagos search',
    lagosResults.every((r) => !names.includes(r.name)),
  )
  check(
    'Lagos pharmacies never leak into the Akwa Ibom search',
    results.every((r) => r.name !== 'LagosMeds Pharmacy' && r.name !== 'Ikeja Central Pharmacy'),
  )

  // 6. Stock toggle round-trip: flip nearest pharmacy out of stock → disappears → restore
  const inv = await prisma.pharmacyInventory.findFirst({
    where: { pharmacyId: closest.id, drugId: paracetamol.id },
  })
  if (!inv) throw new Error('Inventory row missing for toggle test')
  await prisma.pharmacyInventory.update({ where: { id: inv.id }, data: { inStock: false } })
  const afterToggle = await findPharmaciesWithDrug({ drugId: paracetamol.id, state: 'AKWA_IBOM', ...IBOM_PLAZA })
  check(
    'out-of-stock toggle removes pharmacy from results',
    !afterToggle.some((r) => r.id === closest.id) && afterToggle.length === 7,
  )
  await prisma.pharmacyInventory.update({ where: { id: inv.id }, data: { inStock: true } })
  const afterRestore = await findPharmaciesWithDrug({ drugId: paracetamol.id, state: 'AKWA_IBOM', ...IBOM_PLAZA })
  check('restore puts it back', afterRestore.some((r) => r.id === closest.id))

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  if (failures > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
