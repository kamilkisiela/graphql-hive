import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { focusRing } from '@/components/ui/primitives/shared-styles';
import { cn } from '@/lib/utils';
import * as styles from './calendar.css';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const navButton = cn(styles.class2, focusRing);

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(styles.calendarDayPicker, className)}
      classNames={{
        months: 'relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex h-7 items-center justify-center',
        caption_label: 'text-sm font-medium',
        // One nav for all months, laid over the caption row with a button at each outer edge.
        nav: 'absolute inset-x-1 top-0 z-10 flex items-center justify-between',
        button_previous: navButton,
        button_next: navButton,
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-fg-secondary rounded-md w-8 font-normal text-control',
        week: 'flex w-full mt-2',
        // The cell carries aria-selected and the modifiers; the button inside is styled below.
        day: cn(
          styles.calendarDayPicker2,
          props.mode === 'range' ? styles.calendarDayPicker3 : styles.calendarDayPicker4,
        ),
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        outside:
          'text-fg-secondary opacity-50 aria-selected:bg-surface-stripe aria-selected:opacity-30',
        disabled: 'text-fg-secondary opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn(styles.calendarChevronLeft, className)} />
          ) : (
            <ChevronRight className={cn(styles.calendarChevronRight, className)} />
          ),
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

// Later entries win in cn(), so a range endpoint beats today and a range middle beats the endpoint
// look, the same precedence the v8 class map had.
function CalendarDayButton({ day: _day, modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      className={cn(
        styles.calendarDayButtonButton,
        focusRing,
        modifiers.today && styles.calendarDayButtonButton2,
        modifiers.selected && styles.calendarDayButtonButton3,
        modifiers.range_middle && styles.calendarDayButtonButton4,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar };
