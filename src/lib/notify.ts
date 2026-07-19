import { prisma } from './db'
import { sendStockAvailableEmail } from './mail'
import { drugLabel } from './types'

/**
 * Called whenever a pharmacy's inventory row transitions to inStock=true.
 * Emails every pending StockNotifyRequest for that drug in that pharmacy's
 * state, then marks them notified so they don't fire again. Synchronous —
 * fine at this app's scale (dozens of pharmacies), no queue needed.
 */
export async function notifyStockAvailable(drugId: string, pharmacyId: string): Promise<void> {
  const [pharmacy, drug] = await Promise.all([
    prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { name: true, state: true } }),
    prisma.drug.findUnique({ where: { id: drugId } }),
  ])
  if (!pharmacy || !drug) return

  const pending = await prisma.stockNotifyRequest.findMany({
    where: { drugId, state: pharmacy.state, notifiedAt: null },
  })
  if (pending.length === 0) return

  const label = drugLabel({
    id: drug.id,
    genericName: drug.genericName,
    brandNames: drug.brandNames,
    strength: drug.strength,
    form: drug.form,
    packSize: drug.packSize,
  })

  await Promise.all(
    pending.map(async (req) => {
      await sendStockAvailableEmail(req.email, label, pharmacy.name)
      await prisma.stockNotifyRequest.update({ where: { id: req.id }, data: { notifiedAt: new Date() } })
    }),
  )
}
