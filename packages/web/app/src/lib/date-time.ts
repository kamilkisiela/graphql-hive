import { subHours } from 'date-fns';

export function subDays(date: Date | number, days: number) {
  return subHours(date, days * 24);
}
