import { useState } from 'react';
import { endOfToday, subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { createPreview, type NavPath } from 'react-foundry';
import { Calendar } from './calendar';
import * as styles from './calendar.preview.css';

export const nav: NavPath = 'Components/Calendar';

/**
 * The date-range picker's calendar, transcribed from its popover: two months starting last
 * month, range selection, nothing after today. Click a start and an end to see the endpoints
 * and the band between them; click an endpoint again to clear.
 */
function RangeCalendar() {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  return (
    <Calendar
      mode="range"
      defaultMonth={subMonths(new Date(), 1)}
      numberOfMonths={2}
      selected={range}
      onSelect={setRange}
      disabled={[{ after: endOfToday() }]}
    />
  );
}

function SingleCalendar() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  return <Calendar mode="single" selected={selected} onSelect={setSelected} />;
}

export const DateRangePickerCalendar = createPreview(() => (
  <div className={styles.div}>
    <RangeCalendar />
  </div>
));

/** One month, single selection: the shape without the range band, for the cell and today styles. */
export const Single = createPreview(() => (
  <div className={styles.div2}>
    <SingleCalendar />
  </div>
));
