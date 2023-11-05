import { ReactElement } from 'react';
import clsx from 'clsx';

type Props = {
  className?: string;
} & { children: React.ReactNode; title?: ReactElement | string };

export function PolicyConfigBox(props: Props) {
  return (
    <div
      className={clsx(
        'items-center px-4 pb-2 font-mono',
        'title' in props ? undefined : 'flex',
        props.className,
      )}
    >
      {'title' in props ? (
        <>
          <div className="pb-1 text-xs text-gray-600">{props.title}</div>
          <div>{props.children}</div>
        </>
      ) : (
        props.children
      )}
    </div>
  );
}
