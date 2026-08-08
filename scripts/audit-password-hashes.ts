/**
 * Reports what is actually stored in User.passwordHash.
 *
 * The counterpart to needsRehash: that decides what to do with one row
 * when someone signs in, this says how many rows are waiting, and whether
 * anything is stored in a form this app has never written.
 *
 * Read-only. Nothing here can rewrite a hash, because rewriting one
 * requires the plaintext, which only exists during a sign-in — that is
 * what the upgrade path in the login route is for. A row this script
 * flags as not-bcrypt cannot be repaired offline at all: nobody can
 * authenticate against it, and the account needs a password reset.
 *
 * Run with:
 *   DATABASE_URL="<connection string>" npx tsx scripts/audit-password-hashes.ts
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { BCRYPT_COST, parseBcrypt } from '../src/lib/passwords'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/** Shapes worth naming when something is not bcrypt. */
function classify(hash: string): string {
  if (hash === '') return 'EMPTY'
  if (/^\$2[abxy]\$/.test(hash)) return 'bcrypt (malformed)'
  if (/^\$argon2[id]{1,2}\$/.test(hash)) return 'argon2'
  if (/^\$2y\$/.test(hash)) return 'bcrypt (PHP variant)'
  if (/^[a-f0-9]{32}$/i.test(hash)) return 'PLAINTEXT OR MD5 (32 hex chars)'
  if (/^[a-f0-9]{40}$/i.test(hash)) return 'SHA-1 (40 hex chars)'
  if (/^[a-f0-9]{64}$/i.test(hash)) return 'SHA-256 (64 hex chars)'
  return 'UNRECOGNISED — possibly plaintext'
}

async function main() {
  // Only the hash column and the role. Never select the email here: this
  // output gets pasted into issues and chat windows.
  const users = await prisma.user.findMany({ select: { role: true, passwordHash: true } })

  if (users.length === 0) {
    console.log('No user accounts in this database.')
    return
  }

  const byCost = new Map<number, number>()
  const foreign = new Map<string, number>()

  for (const u of users) {
    const parsed = parseBcrypt(u.passwordHash)
    if (parsed) byCost.set(parsed.cost, (byCost.get(parsed.cost) ?? 0) + 1)
    else {
      const kind = classify(u.passwordHash)
      foreign.set(kind, (foreign.get(kind) ?? 0) + 1)
    }
  }

  console.log(`${users.length} account(s). Current work factor is ${BCRYPT_COST}.\n`)
  console.log('  bcrypt hashes by cost')
  console.log('  ' + '-'.repeat(52))
  for (const cost of [...byCost.keys()].sort((a, b) => a - b)) {
    const n = byCost.get(cost)!
    const note = cost < BCRYPT_COST ? '← upgrades on next sign-in' : 'current'
    console.log(`  cost ${String(cost).padStart(2)}   ${String(n).padStart(6)} account(s)   ${note}`)
  }

  const pending = [...byCost.entries()]
    .filter(([cost]) => cost < BCRYPT_COST)
    .reduce((s, [, n]) => s + n, 0)

  if (foreign.size > 0) {
    console.log('\n  NOT BCRYPT — these accounts cannot sign in at all')
    console.log('  ' + '-'.repeat(52))
    for (const [kind, n] of foreign) console.log(`  ${String(n).padStart(6)}  ${kind}`)
    console.log(
      '\n  Nothing in this codebase writes these, so treat them as imported\n' +
        '  or tampered-with. They cannot be repaired offline — the plaintext\n' +
        '  is not recoverable and must not be. Send those accounts through\n' +
        '  the password-reset flow.',
    )
  }

  console.log(
    `\n  ${pending} account(s) below cost ${BCRYPT_COST}, each rewritten the next time it signs in.` +
      (foreign.size === 0 ? '\n  No plaintext, MD5, or SHA-1 hashes found.' : ''),
  )

  // Non-zero exit when something is stored in a form we never write, so
  // this can be wired into a check that is supposed to fail.
  if (foreign.size > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
