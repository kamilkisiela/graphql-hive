const unitToMinutes = {
  m: 1,
  h: 60,
  d: 60 * 24,
};

const unitToClickHouseUnit = {
  m: 'MINUTE',
  h: 'HOUR',
  d: 'DAY',
};

export type ParsedInterval = {
  value: number;
  unit: 'm' | 'h' | 'd';
  clickHouseInterval: string;
};

export function parseInterval(interval: string): ParsedInterval {
  if (!/^\d+(m|h|d)$/.test(interval)) {
    throw new Error('Invalid interval provided.');
  }

  let value = parseInt(interval.slice(0, -1), 10);
  let unit = interval.slice(-1) as 'm' | 'h' | 'd';

  const minutes = value * unitToMinutes[unit];
  const days = minutes / 60 / 24;
  const hours = minutes / 60;

  if (days % 1 === 0) {
    value = days;
    unit = 'd';
  } else if (hours % 1 === 0) {
    value = hours;
    unit = 'h';
  } else {
    value = minutes;
    unit = 'm';
  }

  return {
    value,
    unit,
    clickHouseInterval: `${value} ${unitToClickHouseUnit[unit]}`,
  };
}
