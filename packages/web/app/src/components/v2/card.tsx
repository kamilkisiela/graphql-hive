import { forwardRef, ReactNode } from 'react';
import clsx from 'clsx';

export const Card = forwardRef<
  any,
  { children: ReactNode; className?: string; as?: 'a' }
>(
  (
    { children, className, as, ...props },
    forwardedRef /* if Card is children of next/link */
  ) => {
    const TagToUse = as || 'div';

    return (
      <TagToUse
        ref={forwardedRef}
        className={clsx(
          'rounded-[20px] border border-gray-800 p-5 transition',
          className
        )}
        {...props}
      >
        {children}
      </TagToUse>
    );
  }
);
