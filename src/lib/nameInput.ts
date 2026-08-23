/**
 * One definition of what a person's name may contain, shared by the forms
 * and by the server-side schema in `authValidation`.
 *
 * It lives in its own module rather than in `authValidation` so a client
 * component can import it without dragging zod into the browser bundle —
 * and, more importantly, so the rule the browser enforces and the rule the
 * server enforces cannot drift apart. A stricter client is an annoyance; a
 * looser client is a form that lets you type something and then refuses it
 * on submit, which is what this replaces.
 *
 * "Letters only" is the intent, but taken literally it rejects real names.
 * Ade-Bello, N'Diaye and Jr. are not edge cases here, so the hyphen,
 * apostrophe and full stop stay — as does every script's letters, because
 * Nigerian names are not ASCII-only. Digits and everything else are out.
 */

/** Characters permitted after the first one. Keep in step with NAME_ALLOWED. */
const TAIL = "\\p{L}\\p{M} '.\\-"

/**
 * The full rule: a letter first, then letters, marks, spaces and the three
 * pieces of name punctuation. Anchored, so it describes a whole name.
 */
export const NAME_ALLOWED = new RegExp(`^[\\p{L}\\p{M}][${TAIL}]*$`, 'u')

/**
 * The same rule as an HTML `pattern` attribute.
 *
 * The hyphen is escaped deliberately: browsers compile `pattern` with the
 * regex `v` flag, where a bare `.-` inside a character class is an invalid
 * punctuator sequence — the pattern then fails to compile and is ignored
 * wholesale, silently, taking the rest of the rule with it.
 *
 * `pattern` alone only blocks submission; it does nothing as someone types.
 * It stays because it is what marks the field invalid for assistive tech
 * and for anyone who gets a value into the box another way, but the typing
 * experience comes from `filterNameInput` below.
 */
export const NAME_PATTERN = `[\\p{L}\\p{M}][${TAIL}]*`

const DISALLOWED = new RegExp(`[^${TAIL}]`, 'gu')
const LEADING_NON_LETTER = /^[^\p{L}\p{M}]+/u

/**
 * Drops anything a name may not contain, for use in an input's `onChange`.
 *
 * Deliberately does not trim the end: a trailing space is how someone gets
 * from "Ade" to "Ade Bello", and eating it as they type makes the field
 * feel broken. Leading punctuation and spaces do go, because the rule
 * wants a letter first and there is no way to type toward that from a
 * hyphen. Whitespace normalising is left to the server, which does it once
 * on a finished value rather than on every keystroke.
 */
export function filterNameInput(raw: string): string {
  return raw.replace(DISALLOWED, '').replace(LEADING_NON_LETTER, '')
}

/* ------------------------------------------------------- business names */

/**
 * A pharmacy is not a person, and the rule above would reject a lot of
 * real shops. "CityMed 24/7", "H2O Chemists", "A&B Pharmacy", "Pharmacy
 * No. 3, Ikeja" — digits, ampersands, commas, slashes and brackets all
 * belong in a business name in a way they never belong in a person's.
 *
 * So this is deliberately looser: it keeps what a shop sign might carry
 * and drops the rest. What it will not accept is a name with no letter in
 * it at all — "0000" is not a pharmacy — or the angle brackets that make
 * the name dangerous downstream, since lib/mail.ts interpolates it into
 * the HTML of a stock-alert email.
 */
// Every one of `-`, `/`, `(` and `)` is escaped for the same reason the
// hyphen is above, and this one was found the hard way: under the `v` flag
// they are reserved punctuators inside a character class, so leaving any
// of them bare makes the whole pattern fail to compile. The browser then
// drops it silently and *every* value validates, which looks exactly like
// a rule that is working until you test a value that should fail.
const BIZ_TAIL = "\\p{L}\\p{M}\\p{N} &'.,\\-\\/\\(\\)+"

/** Starts with a letter or digit, and has at least one letter somewhere. */
export const PHARMACY_NAME_ALLOWED = new RegExp(
  `^(?=[^\\p{L}]*\\p{L})[\\p{L}\\p{N}][${BIZ_TAIL}]*$`,
  'u',
)

/** The same rule as an HTML `pattern`. See NAME_PATTERN on the escaping. */
export const PHARMACY_NAME_PATTERN = `(?=[^\\p{L}]*\\p{L})[\\p{L}\\p{N}][${BIZ_TAIL}]*`

const BIZ_DISALLOWED = new RegExp(`[^${BIZ_TAIL}]`, 'gu')
const BIZ_LEADING = /^[^\p{L}\p{N}]+/u

/**
 * Drops anything a shop name may not contain, for an input's `onChange`.
 *
 * The "must contain a letter" half of the rule is not enforced here — it
 * cannot be, because someone typing "24/7 Pharmacy" has only digits in the
 * box for the first four keystrokes. That half is left to `pattern` and to
 * the server, which see a finished value.
 */
export function filterPharmacyNameInput(raw: string): string {
  return raw.replace(BIZ_DISALLOWED, '').replace(BIZ_LEADING, '')
}

/* ------------------------------------------------------------ self-check */

// A `pattern` that does not compile is dropped by the browser without a
// word, and a dropped pattern accepts everything — the rule looks like it
// is working right up until you try a value that should fail. That is not
// a thing to find in production, so compile both here, the way a browser
// would: `v` is the flag `pattern` uses, and it is the strict one.
//
// These are constants, so this either throws the first time the module is
// imported — in dev, or during `next build` — or it never throws at all.
for (const [name, source] of [
  ['NAME_PATTERN', NAME_PATTERN],
  ['PHARMACY_NAME_PATTERN', PHARMACY_NAME_PATTERN],
] as const) {
  try {
    new RegExp(source, 'v')
  } catch (cause) {
    throw new Error(
      `${name} is not a valid HTML pattern — a browser would ignore it and ` +
        `accept every value. Check the escaping inside the character class.`,
      { cause },
    )
  }
}
