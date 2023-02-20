export const CurrencyFormatter = Intl.NumberFormat('en', {
  notation: 'standard',
  currency: 'USD',
  style: 'currency',
});

export const DateFormatter = Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
