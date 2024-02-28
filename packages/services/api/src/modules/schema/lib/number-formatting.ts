export function formatPercentage(percentage: number): string {
  if (percentage < 0.01) {
    return '<0.01%';
  }
  return `${percentage.toFixed(2)}%`;
}

const symbols = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

export function formatNumber(value: number): string {
  // what tier? (determines SI symbol)
  const tier = (Math.log10(Math.abs(value)) / 3) | 0;

  // if zero, we don't need a suffix
  if (tier === 0) {
    return String(value);
  }

  // get suffix and determine scale
  const suffix = symbols[tier];
  const scale = Math.pow(10, tier * 3);

  // scale the number
  const scaled = value / scale;

  // format number and add suffix
  return scaled.toFixed(1) + suffix;
}
