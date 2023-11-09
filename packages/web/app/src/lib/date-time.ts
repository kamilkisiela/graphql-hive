import { subHours } from 'date-fns';

// subDays from date-fns adjusts the hour based on daylight savings time.
// We want to keep the hour the same, so we use subHours instead.
export function subDays(date: Date | number, days: number) {
  return subHours(date, days * 24);
}
