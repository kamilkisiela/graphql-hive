import { ReactElement, ReactNode } from 'react';
import NextLink, { LinkProps } from 'next/link';
import clsx from 'clsx';

export function Link({
  children,
  variant = 'secondary',
  className,
  ...props
}: LinkProps & {
  variant?: 'primary' | 'secondary';
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <NextLink
      className={clsx(
        'font-medium transition-colors',
        variant === 'secondary'
          ? 'text-gray-500 hover:text-gray-300'
          : 'text-orange-500 hover:underline',
        className,
      )}
      {...props}
    >
      {children}
    </NextLink>
  );
}
