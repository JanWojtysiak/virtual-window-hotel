const priceFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
});

/** Formats a PLN amount, e.g. 420 -> "420 zł". */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}
