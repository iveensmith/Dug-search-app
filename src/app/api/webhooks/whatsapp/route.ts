import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { confirmAllStock } from '@/lib/confirmAll'
import { logInventoryAction } from '@/lib/inventoryLog'
import {
  BUTTON_IN_PREFIX,
  BUTTON_OUT_PREFIX,
  HELP_TEXT,
  type Command,
  type MatchableItem,
  itemLabel,
  parseButtonId,
  parseMessage,
  rankMatches,
  whatsappFromToE164,
} from '@/lib/whatsappCommands'

/**
 * Stock updates from the counter, over WhatsApp.
 *
 * The people who actually know what is on a shelf are rarely the person
 * holding the pharmacy's login, and they are never at a desk. This lets
 * them keep the listing honest from the phone already in their hand.
 *
 * Because that is a channel where a text message can flip a shelf to
 * "out" for every patient searching, three things hold throughout:
 *
 *   - the signature is checked before the body is trusted at all;
 *   - the sender must be a number the owner registered, and nothing else
 *     identifies them, so an unknown number is told only that it is not
 *     registered — never which pharmacy it failed to match;
 *   - a free-text guess never changes anything. It asks first.
 *
 * On returning 200 "immediately": Meta retries until it gets one, so the
 * usual advice is to answer first and work afterwards. That is wrong on
 * this deployment — work detached from a response is killed once the
 * response is sent on Vercel, which api/reservations already learned the
 * hard way. The handler is a few indexed queries and one outbound send,
 * comfortably inside Meta's window, so it runs first and the 200 follows.
 * Retries are made harmless by recording the message id instead: see
 * claimMessage below.
 */

/** Meta's own error responses are terse; ours never leak why a match failed. */
const NOT_REGISTERED = 'Your phone number is not registered with a licensed MediQuest pharmacy.'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (!expected) {
    console.error('[whatsapp] WHATSAPP_VERIFY_TOKEN is not set — refusing to verify')
    return new NextResponse('Not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token && challenge && safeEqual(token, expected)) {
    // Plain text, echoed exactly: Meta compares the body byte for byte and
    // a JSON-quoted challenge fails verification.
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    console.error('[whatsapp] WHATSAPP_APP_SECRET is not set — refusing to accept webhooks')
    return new NextResponse('Not configured', { status: 500 })
  }

  // The raw body, before any parsing: the signature covers the exact bytes
  // Meta sent, and a re-serialised object is not those bytes.
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
    // Not 200. An unsigned request is not Meta, so there is no retry storm
    // to protect against — and answering it with a cheerful 200 would hide
    // a misconfigured secret behind a working-looking endpoint.
    console.error('[whatsapp] rejected a payload with a bad or missing signature')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  try {
    const payload = JSON.parse(raw)
    await handlePayload(payload)
  } catch (e) {
    // Deliberately swallowed. A crash here would have Meta redeliver the
    // same broken message on a schedule of its own choosing, and whatever
    // failed is not going to succeed on the fourth attempt.
    console.error('[whatsapp] handler failed', e)
  }

  return NextResponse.json({ received: true })
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // timingSafeEqual throws on a length mismatch, which would itself leak
  // the length — compare lengths first and always run the comparison.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  return safeEqual(header.slice('sha256='.length), expected)
}

type InboundMessage = {
  id?: string
  from?: string
  type?: string
  text?: { body?: string }
  interactive?: { button_reply?: { id?: string } }
}

async function handlePayload(payload: unknown): Promise<void> {
  const value = (payload as { entry?: { changes?: { value?: unknown }[] }[] })?.entry?.[0]
    ?.changes?.[0]?.value as { messages?: InboundMessage[] } | undefined

  const message = value?.messages?.[0]
  // Delivery receipts and read receipts arrive on the same subscription
  // with no `messages` at all. Nothing to do, and not an error.
  if (!message?.from || !message.id) return

  if (!(await claimMessage(message.id))) return

  const phone = whatsappFromToE164(message.from)
  const staff = phone
    ? await prisma.pharmacyStaff.findUnique({
        where: { phone },
        select: {
          id: true,
          active: true,
          pharmacy: { select: { id: true, verificationStatus: true } },
        },
      })
    : null

  // A revoked number and an unknown one get the same sentence. Confirming
  // that a number was once staff at some pharmacy is not something a
  // stranger should be able to establish by texting.
  if (!staff || !staff.active || staff.pharmacy.verificationStatus !== 'APPROVED') {
    await sendWhatsAppMessage({ to: message.from, body: NOT_REGISTERED })
    return
  }

  const command = readCommand(message)
  await runCommand(command, {
    to: message.from,
    staffId: staff.id,
    pharmacyId: staff.pharmacy.id,
  })
}

/**
 * Records a message id, returning false if it was already there.
 *
 * The insert is the lock. Doing it before any work means a redelivery —
 * or two of Meta's workers racing — cannot mark the same drug out twice
 * or restamp a catalogue a second time, without any handler below having
 * to be careful.
 */
async function claimMessage(messageId: string): Promise<boolean> {
  try {
    await prisma.whatsappInbound.create({ data: { messageId } })
    return true
  } catch {
    return false
  }
}

function readCommand(message: InboundMessage): Command {
  const buttonId = message.interactive?.button_reply?.id
  if (buttonId) return parseButtonId(buttonId)
  const body = message.text?.body
  if (typeof body === 'string') return parseMessage(body)
  // Images, voice notes, locations: nothing to act on, so say what does work.
  return { kind: 'help' }
}

type Ctx = { to: string; staffId: string; pharmacyId: string }

async function runCommand(command: Command, ctx: Ctx): Promise<void> {
  switch (command.kind) {
    case 'ignore':
      return
    case 'help':
      await sendWhatsAppMessage({ to: ctx.to, body: HELP_TEXT })
      return
    case 'confirm-all':
      return confirmAll(ctx)
    case 'set-in':
      return setStockById(ctx, command.inventoryId, true, null)
    case 'set-out':
      return setStockById(ctx, command.inventoryId, false, null)
    case 'stock':
      return setStockByName(ctx, command.name, true, command.quantity)
    case 'out':
      return setStockByName(ctx, command.name, false, null)
    case 'search':
      return offerMatch(ctx, command.text)
  }
}

async function confirmAll(ctx: Ctx): Promise<void> {
  const result = await confirmAllStock(ctx.pharmacyId)

  if (!result.ok) {
    const body =
      result.reason === 'nothing-in-stock'
        ? 'Nothing to confirm — none of your medicines are marked in stock.'
        : `Your list was confirmed recently. You can confirm it again in about ${
            result.hoursLeft
          } ${result.hoursLeft === 1 ? 'hour' : 'hours'}.`
    await sendWhatsAppMessage({ to: ctx.to, body })
    return
  }

  await logInventoryAction({
    pharmacyId: ctx.pharmacyId,
    staffId: ctx.staffId,
    action: 'CONFIRMED_ALL',
    source: 'WHATSAPP',
    detail: `${result.confirmed} in stock, ${result.refreshed} were stale`,
  })

  await sendWhatsAppMessage({
    to: ctx.to,
    body: `Confirmed ${result.confirmed} ${
      result.confirmed === 1 ? 'medicine' : 'medicines'
    } as still in stock.${
      result.refreshed > 0
        ? ` ${result.refreshed} had gone stale and ${
            result.refreshed === 1 ? 'is' : 'are'
          } showing to patients again.`
        : ''
    }`,
  })
}

/** Looks up one of this pharmacy's own listings — never another shop's. */
async function findOwnItem(pharmacyId: string, inventoryId: string) {
  return prisma.pharmacyInventory.findFirst({
    where: { id: inventoryId, pharmacyId },
    select: {
      id: true,
      drug: { select: { genericName: true, strength: true, form: true } },
    },
  })
}

async function setStockById(
  ctx: Ctx,
  inventoryId: string,
  inStock: boolean,
  quantity: number | null,
): Promise<void> {
  // Scoped to the sender's pharmacy, so a guessed or replayed button id
  // from another shop's conversation cannot reach across.
  const item = await findOwnItem(ctx.pharmacyId, inventoryId)
  if (!item) {
    await sendWhatsAppMessage({
      to: ctx.to,
      body: "That medicine is not on your shop's list any more.",
    })
    return
  }
  await applyUpdate(ctx, item.id, `${item.drug.genericName} ${item.drug.strength}`, inStock, quantity)
}

async function setStockByName(
  ctx: Ctx,
  name: string,
  inStock: boolean,
  quantity: number | null,
): Promise<void> {
  const matches = await searchOwnStock(ctx.pharmacyId, name)

  if (matches.length === 0) {
    await sendWhatsAppMessage({
      to: ctx.to,
      body: `I couldn't find "${name}" on your shop's list. Check the spelling, or add it from the dashboard first.`,
    })
    return
  }

  // An explicit command still asks when the name is genuinely ambiguous.
  // Silently picking between two strengths of the same drug would put a
  // claim on the wrong shelf, and the sender would never know.
  const [best, second] = matches
  if (second && !isClearWinner(name, best, second)) {
    await askWhichOne(ctx, matches, inStock)
    return
  }

  await applyUpdate(
    ctx,
    best.inventoryId,
    `${best.genericName} ${best.strength}`,
    inStock,
    quantity,
  )
}

/** An exact name match beats a merely-similar one; anything else is a tie. */
function isClearWinner(query: string, best: MatchableItem, second: MatchableItem): boolean {
  const q = query.trim().toLowerCase()
  const exact = (i: MatchableItem) =>
    i.genericName.toLowerCase() === q || i.brandNames.some((b) => b.toLowerCase() === q)
  return exact(best) && !exact(second)
}

async function offerMatch(ctx: Ctx, text: string): Promise<void> {
  const matches = await searchOwnStock(ctx.pharmacyId, text)
  if (matches.length === 0) {
    await sendWhatsAppMessage({
      to: ctx.to,
      body: `I couldn't find "${text}" on your shop's list.\n\n${HELP_TEXT}`,
    })
    return
  }
  await askWhichOne(ctx, matches, null)
}

/**
 * Asks before changing anything.
 *
 * A button carries one action, and its label is a drug name — so the body
 * text is the only place the direction can be stated. Every branch here
 * exists to keep those two in step: a tap must never do something the
 * message did not say it would.
 *
 * One candidate, no direction yet → offer both, named.
 * Several candidates, direction known → all three do the stated thing.
 * Several candidates, no direction → no buttons at all. Three drug names
 *   that all silently mean "mark in stock" is exactly the trap this
 *   whole flow exists to avoid, so it asks for a command instead.
 */
async function askWhichOne(
  ctx: Ctx,
  matches: MatchableItem[],
  intent: boolean | null,
): Promise<void> {
  const [best] = matches

  if (matches.length === 1) {
    await sendWhatsAppMessage({
      to: ctx.to,
      body: `Did you mean ${itemLabel(best)}?`,
      buttons: [
        { id: `${BUTTON_IN_PREFIX}${best.inventoryId}`, title: 'Mark In Stock' },
        { id: `${BUTTON_OUT_PREFIX}${best.inventoryId}`, title: 'Mark Out of Stock' },
      ],
    })
    return
  }

  if (intent === null) {
    const list = matches.slice(0, 5).map((m) => `• ${itemLabel(m)}`).join('\n')
    await sendWhatsAppMessage({
      to: ctx.to,
      body: `You have a few of those:\n${list}\n\nSend "/stock <name> <how many>" or "/out <name>" with the strength, so I change the right one.`,
    })
    return
  }

  const prefix = intent ? BUTTON_IN_PREFIX : BUTTON_OUT_PREFIX
  await sendWhatsAppMessage({
    to: ctx.to,
    body: `Which one do you want to mark ${intent ? 'in stock' : 'out of stock'}?`,
    buttons: matches.slice(0, 3).map((m) => ({
      id: `${prefix}${m.inventoryId}`,
      title: `${m.genericName} ${m.strength}`,
    })),
  })
}

async function applyUpdate(
  ctx: Ctx,
  inventoryId: string,
  label: string,
  inStock: boolean,
  quantity: number | null,
): Promise<void> {
  await prisma.pharmacyInventory.update({
    where: { id: inventoryId },
    // updatedAt is this app's confirmation stamp — the 24-hour freshness
    // cliff and the dashboard both read it, so writing here is what makes
    // the listing count as confirmed just now.
    data: { inStock, ...(quantity !== null ? { quantity } : {}) },
  })

  await logInventoryAction({
    pharmacyId: ctx.pharmacyId,
    staffId: ctx.staffId,
    inventoryId,
    action: inStock ? (quantity !== null ? 'QUANTITY_SET' : 'MARKED_IN_STOCK') : 'MARKED_OUT_OF_STOCK',
    source: 'WHATSAPP',
    detail: quantity !== null ? `${label} → ${quantity}` : label,
  })

  await sendWhatsAppMessage({
    to: ctx.to,
    body: inStock
      ? `${label} is now showing as in stock${
          quantity !== null ? `, ${quantity} on hand` : ''
        }. Patients searching near you will see it.`
      : `${label} is now marked out of stock. Patients will stop seeing it.`,
  })
}

/**
 * Candidate listings from this pharmacy's own inventory.
 *
 * Matched in SQL against generic and brand names — the brand side through
 * drugBrandNamesText(), the same expression the autocomplete's trigram
 * index is built on — then ranked in lib/whatsappCommands, which is where
 * the ordering can be tested without a database.
 */
async function searchOwnStock(pharmacyId: string, query: string): Promise<MatchableItem[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Matched on the first word, not the whole phrase. Staff write the
  // strength to disambiguate — the reply for an ambiguous name asks them
  // to — and "amoxicillin 250 mg" ILIKE'd whole matches no genericName at
  // all. Widening here and narrowing in rankMatches means the strength
  // filters the candidates instead of eliminating them.
  const head = q.split(/\s+/)[0]
  if (head.length < 2) return []
  // % and _ are LIKE wildcards; a query of "%" must not match the shop.
  const pattern = `%${head.replace(/([\\%_])/g, '\\$1')}%`

  const rows = await prisma.$queryRaw<
    { inventoryId: string; genericName: string; brandNames: string[]; strength: string; form: string }[]
  >`
    SELECT i."id" AS "inventoryId", d."genericName", d."brandNames", d."strength", d."form"::text AS "form"
    FROM "PharmacyInventory" i
    JOIN "Drug" d ON d."id" = i."drugId"
    WHERE i."pharmacyId" = ${pharmacyId}
      AND (d."genericName" ILIKE ${pattern} OR "drugBrandNamesText"(d."brandNames") ILIKE ${pattern})
    ORDER BY d."genericName", d."strength"
    LIMIT 25
  `
  return rankMatches(q, rows)
}
