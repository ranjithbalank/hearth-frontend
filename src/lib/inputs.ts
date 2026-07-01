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

/** GSTIN: 15-char uppercase alphanumeric (2 state + 10 PAN + 3). */
export const gstin = (v: string): string =>
  v.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 15);
