import type { DateRange } from '../../../shared/entities';

export const maxResolution = 90;

const inSeconds = {
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function calculateTimeWindow({
  period,
  resolution,
}: {
  period: DateRange;
  resolution: number;
}): {
  value: number;
  unit: 'd' | 'h' | 'm';
  seconds: number;
} {
  if (!Number.isInteger(resolution)) {
    throw new Error(`Invalid resolution. Expected an integer, received ${resolution}`);
  }

  if (resolution < 1 || resolution > maxResolution) {
    throw new Error(
      `Invalid resolution. Expected 1 <= x <= ${maxResolution}, received ${resolution}`,
    );
  }

  const distanceInMinutes = (period.to.getTime() - period.from.getTime()) / 1000 / 60;

  const divideBy = {
    m: 1,
    h: 60,
    d: 60 * 24,
  };

  const value = Math.floor(distanceInMinutes / resolution);
  const unit = calculateUnit(value);
  const correctedValue = Math.floor(value / divideBy[unit]);

  return {
    value: correctedValue,
    unit,
    seconds: correctedValue * inSeconds[unit],
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
