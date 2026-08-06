/** Input filters for controlled fields — keep what the user types clean at the
 *  source so the value handed to Number()/the API is always well-formed. */

/** Digits only, optionally capped in length. Use for counts (nights, covers). */
export const digits = (v: string, max = 6): string =>
  v.replace(/\D/g, "").slice(0, max);

/** A money amount: digits with at most one decimal point and two decimals. */
export function amount(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole.slice(0, 9);
  return `${whole.slice(0, 9)}.${rest.join("").slice(0, 2)}`;
}

/** A signed amount — like amount(), but keeps a single leading minus for
 *  fields that accept negatives (stock adjustments ±). */
export function signedAmount(v: string): string {
  const neg = v.trim().startsWith("-");
  return (neg ? "-" : "") + amount(v);
}

/** The national part of a phone number — digits only, ITU-E.164 length cap.
 *  The country code is NOT typed into this field; it comes from the picker
 *  beside it (see design/PhoneInput). Splitting them is what makes a number
 *  storable one way and searchable at all — before this, phone was a plain
 *  text input on twelve of the fourteen screens that take one. */
export const phone = (v: string, max = 15): string =>
  v.replace(/\D/g, "").slice(0, max);

/** GSTIN: 15-char uppercase alphanumeric (2 state + 10 PAN + 3). */
export const gstin = (v: string): string =>
  v.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 15);

/** A person's name: letters (any script) plus spaces and the punctuation real
 *  names use — hyphen, apostrophe, period (e.g. "Mary-Jane", "O'Neil", "Jr.").
 *  No digits or other symbols. Use ONLY for human-name fields, never for
 *  business/item names or addresses, which legitimately contain numbers.
 *
 *  \p{M} (combining marks) is as load-bearing as \p{L} here. In Devanagari,
 *  Tamil and most Indic scripts the vowel signs are marks, not letters — so
 *  letters-only silently ate them and "मीरा राव" was stored as "मर रव", a
 *  guest's name mangled as they typed it. Latin accents came through only
 *  because é and Á happen to be single precomposed codepoints, which is why
 *  this went unnoticed. Digits and symbols are still stripped. */
export const personName = (v: string, max = 60): string =>
  v.replace(/[^\p{L}\p{M}\s.'-]/gu, "").replace(/\s{2,}/g, " ").slice(0, max);

/** A login name: lower-case letters, digits, dot, underscore, hyphen.
 *  Case-folded here because the server stores usernames lower-case — typing
 *  "Abishek1828" and "abishek1828" has to reach the same account, not create
 *  a second one that looks identical on every screen. Mirrors
 *  accounts/validators.py::validate_username. */
export const username = (v: string, max = 40): string =>
  v.toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "").slice(0, max);
