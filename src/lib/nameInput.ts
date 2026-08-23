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
