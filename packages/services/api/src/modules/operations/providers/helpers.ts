import type { DateRange } from '../../../shared/entities';

export const maxResolution = 90;

export function calculateTimeWindow({
  period,
  resolution,
}: {
  period: DateRange;
  resolution: number;
}): {
  value: number;
  unit: 'd' | 'h' | 'm';
} {
  if (!Number.isInteger(resolution)) {
    throw new Error(
      `Invalid resolution. Expected an integer, received ${resolution}`
    );
  }

  if (resolution < 10 || resolution > maxResolution) {
    throw new Error(
      `Invalid resolution. Expected 10 <= x <= ${maxResolution}, received ${resolution}`
    );
  }

  const distanceInMinutes =
    (period.to.getTime() - period.from.getTime()) / 1000 / 60;

  const divideBy = {
    m: 1,
    h: 60,
    d: 60 * 24,
  };

  const value = Math.ceil(distanceInMinutes / resolution);
  const unit = calculateUnit(value);
  const correctedValue = Math.ceil(value / divideBy[unit]);

  return {
    value: correctedValue,
    unit: calculateUnit(value),
  };
}

function calculateUnit(minutes: number) {
  if (minutes < 60) {
    return 'm' as const;
  }

  if (minutes < 60 * 24) {
    return 'h' as const;
  }

  return 'd' as const;
}
