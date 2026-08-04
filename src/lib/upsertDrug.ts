import { prisma } from './db'
import { Prisma } from '@/generated/prisma/client'
import type { DrugFormValue } from './drugForms'

export type NewDrugInput = {
  genericName: string
  strength: string
  form: DrugFormValue
  packSize?: string | null
  brand?: string
  category?: string | null
}

export class DuplicateDrugError extends Error {}

/** Shared by the single "add a new drug" flow and the bulk CSV importer.
 *  Upserts on the (genericName, strength, form) compound key so the same
 *  drug added by two different pharmacies lands on one shared Drug row. */
export async function upsertDrug(input: NewDrugInput) {
  try {
    const drug = await prisma.drug.upsert({
      where: {
        genericName_strength_form: {
          genericName: input.genericName,
          strength: input.strength,
          form: input.form,
        },
      },
      update: {}, // already exists — don't touch it, caller just links their pharmacy to it
      create: {
        genericName: input.genericName,
        strength: input.strength,
        form: input.form,
        packSize: input.packSize ?? null,
        category: input.category ?? null,
        brandNames: input.brand ? [input.brand] : [],
      },
    })

    // Drug rows are shared between pharmacies, so an existing category is
    // never overwritten — but a blank one can be filled in by whoever
    // knows it first.
    if (input.category && !drug.category) {
      return await prisma.drug.update({
        where: { id: drug.id },
        data: { category: input.category },
      })
    }
    return drug
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicateDrugError('That drug already exists')
    }
    throw e
  }
}
