import { ReactNode, forwardRef } from 'react';
import NextLink, { LinkProps } from 'next/link';
import { clsx } from 'clsx';

export const Card = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
    as?: typeof NextLink;
    href?: LinkProps['href'];
  }
>(({ children, className, as, ...props }, forwardedRef) => {
  const TagToUse = as || 'div';

  return (
    <TagToUse
      // @ts-ignore TODO: figure out what's wrong with ref here
      ref={forwardedRef}
      className={clsx('rounded-md p-5 ring-1 ring-gray-800 transition', className)}
      {...props}
    >
      {children}
    </TagToUse>
  );
});
