export function inr(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n);
}

export function num(value: string | number): number {
  return typeof value === "string" ? Number(value) : value;
}
