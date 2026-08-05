/** Shared phone entry: country-code picker + digits-only national number.
 *
 *  Stores one canonical string, "+919876543210" — code and number concatenated,
 *  no separators, which is exactly what the server's validate_phone accepts and
 *  normalize_phone produces. It used to store "+91 9876543210" with a space,
 *  and splitPhone only recognised the spaced form; once the server started
 *  normalising, a saved number came back unspaced and the parser fell through
 *  to treating the whole thing as a national number, duplicating the country
 *  code on the next edit. splitPhone now reads both forms.
 *
 *  Codes come from lib/countryCodes — the single list, shared with HR. This
 *  file used to carry a second, different one.
 */
import { COUNTRY_CODES, DIAL_CODES_BY_LENGTH } from "../lib/countryCodes";
import { phone as phoneFilter } from "../lib/inputs";

export const DEFAULT_DIAL_CODE = COUNTRY_CODES[0].code;

/** Split a stored value into its parts for editing. Accepts the canonical
 *  "+919876543210", the legacy spaced "+91 9876543210", and a bare national
 *  number (legacy rows are full of those).
 *
 *  A number with no leading + is treated as national under `fallback` rather
 *  than guessed at: the country of a bare ten-digit number is not knowable, and
 *  inventing one makes a guest record undialable. */
export function splitPhone(value: string, fallback = DEFAULT_DIAL_CODE): { code: string; number: string } {
  const raw = (value || "").replace(/[\s()\-./]/g, "");
  if (!raw.startsWith("+")) return { code: fallback, number: raw.replace(/\D/g, "").slice(0, 15) };
  for (const code of DIAL_CODES_BY_LENGTH) {
    if (raw.startsWith(code)) return { code, number: raw.slice(code.length).replace(/\D/g, "").slice(0, 15) };
  }
  // An unlisted code: keep the trailing 10 digits as the number so the value
  // still round-trips instead of being mangled.
  const digits = raw.slice(1).replace(/\D/g, "");
  const cut = Math.max(0, digits.length - 10);
  return { code: `+${digits.slice(0, cut)}`, number: digits.slice(cut) };
}

/** Recombine into the stored form; empty when no digits were entered. */
export function joinPhone(code: string, number: string): string {
  return number ? `${code}${number}` : "";
}

export function PhoneInput({
  code, number, onCode, onNumber, placeholder = "Mobile number", className = "",
  disabled, ariaLabel = "Phone number",
}: {
  code: string;
  number: string;
  onCode: (c: string) => void;
  onNumber: (n: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  // Offer the current code even when it isn't in the curated list, so a
  // property in an unlisted market never silently loses it on the next save.
  const options = COUNTRY_CODES.some((c) => c.code === code)
    ? COUNTRY_CODES
    : [{ code, label: code }, ...COUNTRY_CODES];
  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        className="input w-24 shrink-0"
        value={code}
        disabled={disabled}
        aria-label="Country dialling code"
        onChange={(e) => onCode(e.target.value)}
      >
        {options.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
      </select>
      <input
        className="input flex-1 min-w-0"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        value={number}
        onChange={(e) => onNumber(phoneFilter(e.target.value))}
      />
    </div>
  );
}
