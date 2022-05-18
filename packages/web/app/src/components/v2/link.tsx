import { ComponentProps, forwardRef } from 'react';
import clsx from 'clsx';

export const Link = forwardRef<
  any,
  ComponentProps<'a'> & { variant?: 'primary' | 'secondary' }
>(
  (
    { children, variant = 'secondary', className, ...props },
    forwardedRef /* if Link is children of next/link */
  ) => {
    return (
      <a
        ref={forwardedRef}
        className={clsx(
          'font-medium transition-colors',
          variant === 'secondary'
            ? 'text-gray-500 hover:text-gray-300'
            : 'text-orange-500 hover:underline',
          className
        )}
        {...props}
      >
        {children}
      </a>
    );
  }
);
