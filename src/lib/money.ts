// Property-currency-aware money formatting. The active currency comes from
// Settings > Masters > Currency (property.currency) and is pushed in by
// AppProvider whenever the property loads — everything else just calls
// money() / currencySymbol() and never hardcodes ₹.
// Mirrors the backend's CURRENCY_SYMBOLS in apps/accounts/constants.py — keep in sync.
export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "NPR", symbol: "रू", name: "Nepalese Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
] as const;

let activeSymbol: string = CURRENCIES[0].symbol;

export function setActiveCurrency(code: string | null | undefined) {
  const wanted = (code || "INR").toUpperCase();
  const found = CURRENCIES.find((c) => c.code === wanted);
  activeSymbol = found ? found.symbol : `${wanted} `;
}

export function currencySymbol(): string {
  return activeSymbol;
}

export function money(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return activeSymbol + new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n);
}

export function num(value: string | number): number {
  return typeof value === "string" ? Number(value) : value;
}
