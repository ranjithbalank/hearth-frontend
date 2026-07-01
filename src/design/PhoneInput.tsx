/** Shared phone entry: country-code dropdown + digits-only number field.
 *  Blocks letters/symbols and caps the subscriber number at 12 digits so
 *  every contact captured across the app is clean and consistently formatted
 *  as "<code> <digits>" (e.g. "+91 9876543210"). */

export const DIAL_CODES = ["+91", "+1", "+44", "+971", "+65", "+61", "+49", "+33", "+94", "+880", "+977"];

/** Split a stored "<code> <digits>" string back into its parts for editing. */
export function splitPhone(value: string): { code: string; number: string } {
  const m = (value || "").match(/^(\+\d{1,4})\s+(.*)$/);
  if (m) return { code: m[1], number: m[2].replace(/\D/g, "").slice(0, 12) };
  return { code: "+91", number: (value || "").replace(/\D/g, "").slice(0, 12) };
}

/** Recombine into the stored form; empty when no digits were entered. */
export function joinPhone(code: string, number: string): string {
  return number ? `${code} ${number}` : "";
}

export function PhoneInput({
  code, number, onCode, onNumber, placeholder = "Mobile number", className = "",
}: {
  code: string;
  number: string;
  onCode: (c: string) => void;
  onNumber: (n: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <select className="input w-24" value={code} onChange={(e) => onCode(e.target.value)}>
        {DIAL_CODES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input
        className="input flex-1"
        inputMode="numeric"
        placeholder={placeholder}
        value={number}
        onChange={(e) => onNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
      />
    </div>
  );
}
