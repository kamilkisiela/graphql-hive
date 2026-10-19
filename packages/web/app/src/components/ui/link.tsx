/* eslint-disable @typescript-eslint/no-restricted-imports */
import { ComponentProps, PropsWithChildren } from 'react';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import { LinkOptions, RegisteredRouter, Link as RouterLink } from '@tanstack/react-router';
import * as styles from './link.css';

const linkVariants = lenient(styles.linkVariants);

type LinkProps<TTo extends string> = LinkOptions<RegisteredRouter, '/', TTo> &
  NonNullable<Parameters<typeof linkVariants>[0]> &
  PropsWithChildren<Pick<ComponentProps<'a'>, 'href' | 'className' | 'target' | 'ref' | 'rel'>>;

export const Link = <TTo extends string = '.'>({
  className,
  variant = 'primary',
  children,
  ...props
}: LinkProps<TTo> & {
  as?: 'a';
}) => {
  // An `href` with no `to` is a link out of the app: the router's Link would re-resolve it as an
  // internal location and drop the origin, so it renders as a plain anchor.
  if (props.as === 'a' || (props.href && !('to' in props))) {
    return (
      <a className={cn(linkVariants({ variant }), className)} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink href="" className={cn(linkVariants({ variant }), className)} {...props}>
      {children}
    </RouterLink>
  );
};

// @ts-expect-error just to make sure Link is type safe
export const _ = Link({ to: '/non-existing-route' });
