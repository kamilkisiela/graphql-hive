const minuteInMs = 60 * 1000;
const hourInMs = 60 * minuteInMs;
const dayInMs = 24 * hourInMs;

const unitToMs = {
  d: dayInMs,
  h: hourInMs,
  m: minuteInMs,
};

export function toStartOfInterval(
  date: Date,
  intervalValue: number,
  intervalUnit: 'd' | 'h' | 'm',
): Date {
  const unixTimestamp = date.getTime();
  const div = intervalValue * unitToMs[intervalUnit];
  return new Date(Math.floor(unixTimestamp / div) * div);
}

export function toEndOfInterval(
  date: Date,
  intervalValue: number,
  intervalUnit: 'd' | 'h' | 'm',
): Date {
  const unixTimestamp = date.getTime();
  const div = intervalValue * unitToMs[intervalUnit];
  return new Date(Math.ceil(unixTimestamp / div) * div - 1);
}
