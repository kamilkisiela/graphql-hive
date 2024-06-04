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
  children,
  ...props
}: LinkProps<TTo> & {
  as?: 'a';
}) => {
  if (props.as === 'a') {
    return (
      <a className={cn(linkVariants({ variant, className }))} {...props}>
        {children}
      </a>
    );
  }

  return (
    // @ts-expect-error It's a legacy component and I don't want to spend time fixing a type error
    <RouterLink href="" className={cn(linkVariants({ variant, className }))} {...props}>
      {children}
    </RouterLink>
  );
};

// @ts-expect-error just to make sure Link is type safe
export const _ = Link({ to: '/non-existing-route' });
