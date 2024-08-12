import { ComponentPropsWithoutRef } from 'react';
import { Anchor } from '@theguild/components';
import { cn } from '../lib';

interface CallToActionProps extends ComponentPropsWithoutRef<typeof Anchor> {
  href: string;
  variant: 'primary' | 'primary-inverted' | 'secondary';
}

/**
 * This is `Button` in the new design system.
 * TODO: Move it to the components library?
 */
export function CallToAction({ className, variant, ...rest }: CallToActionProps) {
  return (
    <Anchor
      className={cn(
        'inline-flex w-fit flex-row items-center gap-2',
        'text-green-1000 rounded-lg border border-green-800 bg-green-300 px-6 py-3 font-medium leading-6',
        'focus-visible:ring-0 focus-visible:ring-offset-0',
        // todo: use cva later
        variant === 'primary'
          ? 'bg-primary hover:bg-green-800 hover:text-white' +
              ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-800'
          : variant === 'primary-inverted'
            ? 'bg-primary hover:bg-white' +
              ' focus-visible:outline-4 focus-visible:outline-offset-0 focus-visible:outline-white/40'
            : 'bg-green-300 hover:bg-green-200' +
              ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-300/40',
        className,
      )}
      {...rest}
    />
  );
}
