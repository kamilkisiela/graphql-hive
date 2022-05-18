import { CSSProperties, ReactElement } from 'react';
import clsx from 'clsx';

type Props = {
  // children?: ReactNode;
  className?: string;
  visible: boolean;
  circle?: boolean;
  width?: CSSProperties['width'];
};

export const Skeleton = ({
  className,
  visible,
  circle,
  width,
  ...props
}: Props): ReactElement => {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-900',
        circle ? 'rounded-full' : 'rounded-[10px]',
        className
      )}
      style={{ width }}
      {...props}
    />
  );
};
