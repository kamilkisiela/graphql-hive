import { forwardRef, ReactNode } from 'react';
import NextLink, { LinkProps } from 'next/link';
import { cn } from '@/lib/utils';

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
        className={cn('rounded-md p-5 border border-gray-800', className)}
        {...props}
      >
        {children}
      </TagToUse>
    );
  },
);
