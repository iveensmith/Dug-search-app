/**
 * Server-side validation for the auth forms.
 *
 * The browser checks are a courtesy to whoever is filling in the form.
 * These are the ones that count: every rule here runs on input that
 * arrived over the wire, from a client we have no control over, whatever
 * the form did or didn't do first.
 *
 * Two deliberate positions on "sanitising", because they pull in
 * opposite directions:
 *
 *  - Free text that a human wrote and other humans read back — the
 *    display name — is cleaned. Not because React would render a script
 *    tag (it escapes), but because lib/mail.ts interpolates the name
 *    straight into HTML email bodies, and an inbox is not React.
 *
 *  - Credentials are never cleaned, only accepted or rejected. Stripping
 *    characters out of a password silently changes it, so the account it
 *    creates cannot be logged into by typing the password that was
 *    chosen. Stripping them out of an email address quietly delivers to
 *    somebody else. Where the value has to survive intact, the answer to
 *    a bad one is "no", not "here, I fixed it".
 */

import { z } from 'zod'

/* ---------------------------------------------------------------- limits */

/** RFC 5321 caps an address at 254 characters; anything longer is noise. */
const MAX_EMAIL = 254

/**
 * bcrypt hashes the first 72 *bytes* and silently ignores the rest, so a
 * longer password is not the stronger password it looks like. New ones
 * are held to what actually gets hashed rather than being quietly cut
 * down to it.
 */
const MAX_NEW_PASSWORD_BYTES = 72
const MIN_PASSWORD = 8

/**
 * Sign-in keeps the old, looser ceiling. Accounts created before the cap
 * may have a password longer than bcrypt uses; rejecting it at the door
 * now would lock those people out of accounts they can still open.
 */
const MAX_LOGIN_PASSWORD = 200

const MIN_NAME = 2
const MAX_NAME = 80

/* ------------------------------------------------------------ sanitising */

/** C0/C1 control characters — never typed, only ever pasted or scripted. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/

/**
 * Anything a name genuinely needs: letters in any script (Nigerian names
 * are not ASCII-only), combining marks, spaces, and the three pieces of
 * punctuation that show up in real names — Ade-Bello, N'Diaye, Jr.
 */
const NAME_ALLOWED = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u

/**
 * Strips markup from a display name and normalises the whitespace.
 *
 * Tag-shaped text goes first, then any stray angle brackets, so
 * `<scr<b>ipt>` cannot reassemble itself once the inner tag is removed.
 * Whatever survives still has to pass NAME_ALLOWED — this reduces what
 * has to be rejected, it does not decide what is acceptable.
 */
export function sanitizeDisplayName(raw: string): string {
  let out = raw.normalize('NFC')
  let previous: string
  do {
    previous = out
    out = out.replace(/<[^>]*>/g, '')
  } while (out !== previous)
  return out
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* -------------------------------------------------------------- (schemas) */

const emailSchema = z
  .string()
  .max(MAX_EMAIL)
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => !CONTROL_CHARS.test(v), 'control characters')
  .pipe(z.email().max(MAX_EMAIL))

const displayNameSchema = z
  .string()
  .max(MAX_NAME * 4) // room for markup that is about to be stripped
  .transform(sanitizeDisplayName)
  .pipe(z.string().min(MIN_NAME).max(MAX_NAME).regex(NAME_ALLOWED, 'unsupported characters'))

/** Sign-up and reset: what we are willing to store from here on. */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD)
  .refine(
    (v) => new TextEncoder().encode(v).length <= MAX_NEW_PASSWORD_BYTES,
    `at most ${MAX_NEW_PASSWORD_BYTES} bytes`,
  )
  .refine((v) => !CONTROL_CHARS.test(v), 'control characters')
  .refine((v) => v.trim().length > 0, 'blank')

/** Sign-in: bounded, but never re-judging a password someone already has. */
const loginPasswordSchema = z
  .string()
  .min(1)
  .max(MAX_LOGIN_PASSWORD)
  .refine((v) => !CONTROL_CHARS.test(v), 'control characters')

/**
 * Email or Nigerian phone number — the login form takes either, and which
 * one it is only gets decided in findUsersByIdentifier. Both branches are
 * checked here so neither reaches a query as free text.
 */
const identifierSchema = z
  .string()
  .max(MAX_EMAIL)
  .transform((v) => v.trim())
  .refine((v) => !CONTROL_CHARS.test(v), 'control characters')
  .refine(
    (v) =>
      v.includes('@')
        ? z.email().max(MAX_EMAIL).safeParse(v).success
        : /^\+?[\d\s()-]{7,20}$/.test(v),
    'not an email address or phone number',
  )

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: loginPasswordSchema,
  // Which portal tab the login form had open. Defaults to the patient tab
  // so a body without it can't quietly skip the role check.
  portal: z.enum(['patient', 'pharmacy']).default('patient'),
})

export const registerSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema.optional(),
  password: newPasswordSchema,
  state: z.string().optional(),
  accountType: z.enum(['patient', 'pharmacy']).optional(),
})

/* --------------------------------------------------------------- replies */

/**
 * One reply for every rejected body, so a caller probing the endpoint
 * learns nothing from the difference between a malformed email and a
 * short password.
 *
 * This covers *validation* only. It is not meant to flatten the answers
 * further down — "no pharmacy account with that email" and "wrong
 * password" are deliberate, and a person who cannot tell those apart
 * cannot tell whether to register or to keep trying.
 */
export const INVALID_INPUT_MESSAGE =
  'Check the details you entered and try again.'

/* --------------------------------------------------------------- logging */

/**
 * Records a rejection for whoever is watching the logs.
 *
 * Field names and Zod's issue codes, never the values: the point is to
 * see a client sending malformed bodies at 30 a second, and none of that
 * requires keeping the passwords it sent. The address is reduced to a
 * short hash so repeat attempts on one account can still be counted
 * without the log becoming a list of who uses the service.
 */
export function logValidationFailure(
  route: string,
  req: Request,
  error: z.ZodError | null,
  subject?: string,
): void {
  const fields = error
    ? [...new Set(error.issues.map((i) => `${i.path.join('.') || '(body)'}:${i.code}`))]
    : ['(body):not_json']

  console.warn(
    '[auth-validation] ' +
      JSON.stringify({
        route,
        fields,
        subject: subject ? fingerprint(subject) : undefined,
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
          req.headers.get('x-real-ip') ??
          null,
        agent: req.headers.get('user-agent')?.slice(0, 120) ?? null,
        at: new Date().toISOString(),
      }),
  )
}

/** Stable, non-reversible, and short enough to read in a log line. */
function fingerprint(value: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Reads a JSON body without letting a malformed one throw. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
