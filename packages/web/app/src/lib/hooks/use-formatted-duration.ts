import { useMemo } from 'react';
import { toDecimal } from './use-decimal';

export function formatDuration(duration: number, showZero = false) {
  if (duration === 0 && !showZero) {
    return '-';
  }

  if (duration < 1000) {
    return `${duration}ms`;
  }

  return `${toDecimal(duration / 1000)}s`;
}

export function useFormattedDuration(duration?: number): string {
  return useMemo(() => (duration === undefined ? '-' : formatDuration(duration, true)), [duration]);
}
