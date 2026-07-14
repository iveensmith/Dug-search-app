// Phase 1 end-to-end verification: seed data present, distance query
// correct, approval gating enforced, stock toggle reflected in search.
// Run with: npm run verify:phase1
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { findPharmaciesWithDrug } from '../src/lib/geo'

const IBOM_PLAZA = { lat: 5.0407, lng: 7.9204 } // Uyo city centre

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
  check('seed counts', users === 13 && drugs === 30 && pharmacies === 10 && inventory > 100)

  // 2. Search: Paracetamol 500 mg near Ibom Plaza — every approved pharmacy stocks it
  const paracetamol = await prisma.drug.findFirst({
    where: { genericName: 'Paracetamol', form: 'TABLET' },
  })
  if (!paracetamol) throw new Error('Paracetamol seed row missing')

  const results = await findPharmaciesWithDrug({
    drugId: paracetamol.id,
    ...IBOM_PLAZA,
    radiusKm: 10,
  })
  console.log(`\nParacetamol 500 mg within 10 km of Ibom Plaza: ${results.length} pharmacies`)
  for (const r of results) {
    console.log(`  ${r.distanceKm.toFixed(2).padStart(5)} km  ${r.name} — ${r.address} (${r.phone})`)
  }
  check('all 8 approved pharmacies found', results.length === 8)

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
  const noResults = await findPharmaciesWithDrug({ drugId: insulin.id, ...IBOM_PLAZA, radiusKm: 10 })
  check('orphan drug returns zero results', noResults.length === 0)

  // 5. Radius respected: tiny radius returns only the city-centre pharmacy
  const nearOnly = await findPharmaciesWithDrug({
    drugId: paracetamol.id,
    ...IBOM_PLAZA,
    radiusKm: 1,
  })
  check(
    'radius filter works (1 km → only city centre)',
    nearOnly.length >= 1 && nearOnly.every((r) => r.distanceKm <= 1),
    `${nearOnly.length} result(s) within 1 km`,
  )

  // 6. Stock toggle round-trip: flip nearest pharmacy out of stock → disappears → restore
  const inv = await prisma.pharmacyInventory.findFirst({
    where: { pharmacyId: closest.id, drugId: paracetamol.id },
  })
  if (!inv) throw new Error('Inventory row missing for toggle test')
  await prisma.pharmacyInventory.update({ where: { id: inv.id }, data: { inStock: false } })
  const afterToggle = await findPharmaciesWithDrug({ drugId: paracetamol.id, ...IBOM_PLAZA, radiusKm: 10 })
  check(
    'out-of-stock toggle removes pharmacy from results',
    !afterToggle.some((r) => r.id === closest.id) && afterToggle.length === 7,
  )
  await prisma.pharmacyInventory.update({ where: { id: inv.id }, data: { inStock: true } })
  const afterRestore = await findPharmaciesWithDrug({ drugId: paracetamol.id, ...IBOM_PLAZA, radiusKm: 10 })
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
