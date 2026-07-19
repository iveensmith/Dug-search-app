import { prisma } from './db'
import { Prisma } from '@/generated/prisma/client'
import type { DrugFormValue } from './drugForms'

export type NewDrugInput = {
  genericName: string
  strength: string
  form: DrugFormValue
  packSize?: string | null
  brand?: string
}

export class DuplicateDrugError extends Error {}

/** Shared by the single "add a new drug" flow and the bulk CSV importer.
 *  Upserts on the (genericName, strength, form) compound key so the same
 *  drug added by two different pharmacies lands on one shared Drug row. */
export async function upsertDrug(input: NewDrugInput) {
  try {
    return await prisma.drug.upsert({
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
        brandNames: input.brand ? [input.brand] : [],
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicateDrugError('That drug already exists')
    }
    throw e
  }
}
