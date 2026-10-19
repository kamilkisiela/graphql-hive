import { ReactElement, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import * as styles from './time-ago.css';

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

// Terse relative label ("now" / "5m ago" / "3h ago" / "12d ago"), matching the
// old @n1ru4l/react-time-ago look, but rolling up past days into w/mo/y so old
// dates stay readable (e.g. "2y ago" instead of "912d ago"). Months/years use
// approximate 30/365-day buckets, which is fine at this granularity.
export function formatTimeAgo(dateObj: Date, now: number): string {
  const d = (now - dateObj.getTime()) / 1000;
  if (d < MINUTE * 2) {
    return 'now';
  }
  if (d < HOUR) {
    return `${Math.floor(d / MINUTE)}m ago`;
  }
  if (d < DAY) {
    return `${Math.floor(d / HOUR)}h ago`;
  }
  if (d < WEEK) {
    return `${Math.floor(d / DAY)}d ago`;
  }
  if (d < MONTH) {
    return `${Math.floor(d / WEEK)}w ago`;
  }
  if (d < YEAR) {
    return `${Math.floor(d / MONTH)}mo ago`;
  }
  return `${Math.floor(d / YEAR)}y ago`;
}

// Re-render cadence for the live label. A fixed 30s tick keeps the
// minute-granular output feeling live without churning (the finest unit is
// minutes, so 30s always refreshes at least as often as the label can change).
const REFRESH_INTERVAL_MS = 30_000;

export const TimeAgo = ({
  date,
  className,
}: {
  date?: string;
  className?: string;
}): ReactElement | null => {
  const [now, setNow] = useState(() => Date.now());

  const { dateObj, formattedDate } = useMemo(() => {
    if (!date) {
      return {};
    }
    const dateObj = new Date(date);
    const formattedDate = format(dateObj, 'y-MM-dd');
    return { dateObj, formattedDate };
  }, [date]);

  useEffect(() => {
    if (!dateObj) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dateObj]);

  if (!date || !dateObj) {
    return null;
  }

  return (
    <time
      dateTime={formattedDate}
      title={formattedDate}
      className={clsx(styles.timeAgoTime, className)}
    >
      {formatTimeAgo(dateObj, now)}
    </time>
  );
};
