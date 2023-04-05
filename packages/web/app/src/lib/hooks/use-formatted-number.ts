import { useMemo } from 'react';

const symbols = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

export function formatNumber(value: number) {
  // what tier? (determines SI symbol)
  const tier = (Math.log10(Math.abs(value)) / 3) | 0;

  // if zero, we don't need a suffix
  if (tier === 0) {
    return value;
  }

  // get suffix and determine scale
  const suffix = symbols[tier];
  const scale = Math.pow(10, tier * 3);

  // scale the number
  const scaled = value / scale;

  // format number and add suffix
  return scaled.toFixed(1) + suffix;
}

export function useFormattedNumber(value?: number) {
  return useMemo(() => (typeof value === 'undefined' ? '-' : formatNumber(value)), [value]);
}
