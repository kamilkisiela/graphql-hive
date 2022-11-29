import { forwardRef, ReactNode } from 'react';
import NextLink, { LinkProps } from 'next/link';
import { clsx } from 'clsx';

type CardProps = (
  | {
      as?: never;
      href?: never;
    }
  | ({
      as: typeof NextLink;
    } & LinkProps)
) & {
  children?: ReactNode;
  className?: string;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, as, ...props }, forwardedRef) => {
    const TagToUse = as || 'div';

    return (
      <TagToUse
        // @ts-expect-error TODO: figure out what's wrong with ref here
        ref={forwardedRef}
        className={clsx('rounded-md p-5 ring-1 ring-gray-800 transition', className)}
        {...props}
      >
        {children}
      </TagToUse>
    );
  },
);
