import { ReactNode } from 'react';
import NextLink, { LinkProps } from 'next/link';
import { clsx } from 'clsx';

export function Card({
  children,
  className,
  as,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & (
  | {
      as: never;
      href: never;
    }
  | ({
      as: typeof NextLink;
    } & Omit<LinkProps, 'as'>)
)) {
  const TagToUse = as || 'div';

  return (
    <TagToUse
      className={clsx('rounded-md p-5 ring-1 ring-gray-800 transition', className)}
      {...props}
    >
      {children}
    </TagToUse>
  );
}
