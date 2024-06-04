import { ReactElement, ReactNode } from 'react';
import clsx from 'clsx';

export const Heading = ({
  children,
  size = 'xl',
  className,
  ...props
}: {
  children: ReactNode;
  size?: 'lg' | 'xl' | '2xl';
  className?: string;
  id?: string;
}): ReactElement => {
  const HeadingLevel = size === '2xl' ? 'h1' : 'h3';

  return (
    <HeadingLevel
      className={clsx(
        'cursor-default text-white',
        {
          lg: 'text-lg font-bold',
          xl: 'text-xl font-bold',
          '2xl': 'text-[28px] font-extrabold leading-snug',
        }[size],
        className,
      )}
      {...props}
    >
      {children}
    </HeadingLevel>
  );
};
