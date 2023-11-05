import { ReactElement, useMemo } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { TimeAgo as ReactTimeAgo } from '@n1ru4l/react-time-ago';

export const TimeAgo = ({
  date,
  className,
}: {
  date?: string;
  className?: string;
}): ReactElement | null => {
  const { dateObj, formattedDate } = useMemo(() => {
    if (!date) {
      return {};
    }
    const dateObj = new Date(date);
    const formattedDate = format(dateObj, 'y-MM-dd');
    return { dateObj, formattedDate };
  }, [date]);

  if (!date || !dateObj) {
    return null;
  }

  return (
    <ReactTimeAgo date={dateObj}>
      {({ value }) => (
        <time
          dateTime={formattedDate}
          title={formattedDate}
          className={clsx('cursor-default whitespace-nowrap', className)}
        >
          {value}
        </time>
      )}
    </ReactTimeAgo>
  );
};
