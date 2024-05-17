/* eslint-disable @typescript-eslint/no-restricted-imports */
import { ComponentProps, PropsWithChildren } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { LinkOptions, RegisteredRouter, Link as RouterLink } from '@tanstack/react-router';

const linkVariants = cva('font-medium transition-colors', {
  variants: {
    variant: {
      primary: 'text-orange-500 hover:underline',
      secondary: 'text-gray-500 hover:text-gray-300',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

type RouterLinkProps<TTo extends string> = LinkOptions<RegisteredRouter, '/', TTo> & {
  as?: never;
} & PropsWithChildren<Pick<ComponentProps<'a'>, 'className' | 'target' | 'ref' | 'rel'>>;

type LinkProps<TTo extends string> = VariantProps<typeof linkVariants> &
  (
    | RouterLinkProps<TTo>
    | ({
        as: 'a';
      } & PropsWithChildren<
        Pick<ComponentProps<'a'>, 'href' | 'className' | 'target' | 'ref' | 'rel'>
      >)
  );

export const Link = <TTo extends string = '.'>({
  className,
  variant = 'primary',
  children,
  ...props
}: LinkProps<TTo>) => {
  if (props.as === 'a') {
    return (
      <a className={cn(linkVariants({ variant, className }))} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink className={cn(linkVariants({ variant, className }))} {...props}>
      {children}
    </RouterLink>
  );
};
