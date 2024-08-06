import { ComponentPropsWithoutRef } from 'react';
import { Anchor } from '@theguild/components';
import { cn } from '../lib';

// todo: use cva later?
const variantStyles = {
  primary: cn(
    'bg-primary hover:bg-green-800 hover:text-white' +
      ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-800',
  ),
  'primary-inverted': cn(''),
};

type CallToActionVariant = keyof typeof variantStyles;

interface CallToActionProps extends ComponentPropsWithoutRef<typeof Anchor> {
  href: string;
  variant: 'primary' | 'primary-inverted' | 'secondary';
}

/**
 * This is `Button` in the new Hive brand design system.
 * TODO: Move it to the components library?
 */
export function CallToAction({ className, variant, ...rest }: CallToActionProps) {
  return (
    <Anchor
      className={cn(
        'inline-flex w-fit flex-row items-center gap-2',
        'text-green-1000 rounded-lg border border-green-800 bg-green-300 px-6 py-3 font-medium leading-6',
        'focus-visible:ring-0 focus-visible:ring-offset-0',
        variantStyles[variant],
        className,
      )}
      {...rest}
    />
  );
}
