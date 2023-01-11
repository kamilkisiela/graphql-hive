import { useMemo } from 'react';

export function toDecimal(value: number, places = 2) {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });

  return formatter.format(value);
}

export function useDecimal(value: number) {
  return useMemo(() => toDecimal(value), [value]);
}
