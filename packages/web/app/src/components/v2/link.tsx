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

type LinkProps<TTo extends string> = LinkOptions<RegisteredRouter, '/', TTo> &
  VariantProps<typeof linkVariants> &
  PropsWithChildren<Pick<ComponentProps<'a'>, 'href' | 'className' | 'target' | 'ref' | 'rel'>>;

export const Link = <TTo extends string = '.'>({
  className,
  variant = 'primary',
  ...props
}: LinkProps<TTo>) => {
  return <RouterLink className={cn(linkVariants({ variant, className }))} {...props} />;
};
