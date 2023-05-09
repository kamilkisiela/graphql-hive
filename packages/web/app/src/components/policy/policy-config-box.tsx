import { ReactElement } from 'react';
import clsx from 'clsx';

type Props = {
  className?: string;
} & { children: React.ReactNode; title?: ReactElement | string };

export function PolicyConfigBox(props: Props) {
  return (
    <div
      className={clsx(
        'px-4 items-center font-mono pb-2',
        'title' in props ? undefined : 'flex',
        props.className,
      )}
    >
      {'title' in props ? (
        <>
          <div className="text-xs pb-1 text-gray-600">{props.title}</div>
          <div>{props.children}</div>
        </>
      ) : (
        props.children
      )}
    </div>
  );
}
