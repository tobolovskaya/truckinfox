export function formatCurrency(amount: number, currency = 'NOK') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDistance(km: number) {
  return `${km.toFixed(1)} km`;
}
