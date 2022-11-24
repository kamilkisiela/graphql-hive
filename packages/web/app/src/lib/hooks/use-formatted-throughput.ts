import React from 'react';
import { toDecimal } from './use-decimal';
import { formatNumber } from './use-formatted-number';

export function formatThroughput(requests: number, window: number) {
  const distance = window / (60 * 1000);
  const rpm = requests / distance;

  if (rpm >= 1000) {
    return formatNumber(rpm);
  }

  if (rpm >= 100) {
    return toDecimal(rpm, 2);
  }

  if (rpm >= 10) {
    return toDecimal(rpm, 3);
  }

  return toDecimal(rpm, 4);
}

export function useFormattedThroughput({
  requests,
  window,
}: {
  requests?: number;
  window: number;
}) {
  return React.useMemo(
    () => (typeof requests === 'undefined' ? '-' : formatThroughput(requests, window)),
    [requests, window],
  );
}
