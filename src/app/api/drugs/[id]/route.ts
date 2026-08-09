import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { findPharmaciesWithDrug } from '@/lib/geo'
import { isValidState, stateCenter } from '@/lib/states'
import { isValidLga } from '@/lib/lgas'

type RouteContext = { params: Promise<{ id: string }> }

const paramsSchema = z.object({
  state: z.string().refine(isValidState, { message: 'Unknown state' }).optional(),
  lga: z.string().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

/**
 * One drug, plus where to get it. Location params are optional: without a
 * state we can still describe the drug and list its siblings, we just
 * can't say who stocks it nearby.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const parsed = paramsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }
  const { state, lat, lng } = parsed.data
  const lga = state && parsed.data.lga && isValidLga(state, parsed.data.lga) ? parsed.data.lga : null

  const drug = await prisma.drug.findUnique({ where: { id } })
  if (!drug) return NextResponse.json({ error: 'Drug not found' }, { status: 404 })

  let stockedBy: Awaited<ReturnType<typeof findPharmaciesWithDrug>> = []
  if (state) {
    const centre = stateCenter(state)!
    stockedBy = await findPharmaciesWithDrug({
      drugId: id,
      state,
      lga,
      lat: lat ?? centre.lat,
      lng: lng ?? centre.lng,
      limit: 5,
    })
  }

  // Other strengths/forms of the same generic — the patient's realistic
  // alternatives if this exact one isn't around.
  const siblings = await prisma.drug.findMany({
    where: { genericName: drug.genericName, id: { not: id } },
    take: 6,
  })

  return NextResponse.json({
    drug: {
      id: drug.id,
      genericName: drug.genericName,
      brandNames: drug.brandNames,
      strength: drug.strength,
      form: drug.form,
      packSize: drug.packSize,
      // The page has always had markup for the class tag; it never showed
      // because this shape dropped the field on the way out.
      category: drug.category,
      dispensing: drug.dispensing,
    },
    stockedBy,
    siblings: siblings.map((d) => ({
      id: d.id,
      genericName: d.genericName,
      brandNames: d.brandNames,
      strength: d.strength,
      form: d.form,
      packSize: d.packSize,
      category: d.category,
      dispensing: d.dispensing,
    })),
  })
}
