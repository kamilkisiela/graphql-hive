import { differenceInWeeks, format, formatDistanceToNow } from 'date-fns';

export function TimeAgo(props: { date: string; className?: string }) {
  const date = new Date(props.date);
  const weeks = differenceInWeeks(new Date(), date);
  const text =
    weeks <= 1
      ? formatDistanceToNow(date, {
          addSuffix: true,
        })
      : format(date, 'PP p');

  return (
    <span className={props.className} title={format(date, 'PP p')}>
      {text}
    </span>
  );
}
