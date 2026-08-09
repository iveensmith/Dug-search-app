import { prisma } from './db'
import type { InventoryAction, InventoryLogSource } from '../generated/prisma/enums'

/**
 * Records who changed a stock listing, when, and through what.
 *
 * Stock claims are the one thing this app asks patients to trust, and
 * WhatsApp makes them changeable by someone holding a phone rather than
 * an account. The owner needs to be able to read back what was done in
 * their name — and, when a number is revoked, what it did while it was
 * trusted.
 *
 * Never throws. A failed audit write must not undo a stock update that
 * has already happened, and must not cost a staff member the reply
 * telling them it happened; a dropped log line is a lesser harm than
 * either.
 */
export async function logInventoryAction(entry: {
  pharmacyId: string
  action: InventoryAction
  source: InventoryLogSource
  staffId?: string | null
  inventoryId?: string | null
  detail?: string | null
}): Promise<void> {
  try {
    await prisma.inventoryLog.create({
      data: {
        pharmacyId: entry.pharmacyId,
        action: entry.action,
        source: entry.source,
        staffId: entry.staffId ?? null,
        inventoryId: entry.inventoryId ?? null,
        detail: entry.detail ?? null,
      },
    })
  } catch (e) {
    console.error('[inventory-log] failed to record', entry.action, e)
  }
}
