import { forwardRef, ReactNode } from 'react';
import clsx from 'clsx';

export const Card = forwardRef<any, { children: ReactNode; className?: string; as?: 'a' }>(
  ({ children, className, as, ...props }, forwardedRef /* if Card is children of next/link */) => {
    const TagToUse = as || 'div';

    return (
      <TagToUse
        ref={forwardedRef}
        className={clsx('rounded-md p-5 ring-1 ring-gray-800 transition', className)}
        {...props}
      >
        {children}
      </TagToUse>
    );
  }
);
