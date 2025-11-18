// client/src/lib/currency.ts

const CURRENCY = "BHD";
const LOCALE = "en-BH"; // or "ar-BH" if you prefer Arabic

export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 3, // BHD commonly 3 decimals; change to 2 if you want
  }).format(safe);
}

// If you store prices as cents (e.g. 1000 = 1.000 BHD)
export function formatFromCents(cents?: number | null): string {
  const value = typeof cents === "number" ? cents / 100 : 0;
  return formatMoney(value);
}
