import { ComponentPropsWithoutRef } from 'react';
import { Anchor } from '@theguild/components';
import { cn } from '../lib';

// todo: use cva later?
const variantStyles = {
  primary: cn(
    'bg-primary hover:bg-green-800 hover:text-white' +
      ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-800',
  ),
  'primary-inverted': cn(
    'bg-primary hover:bg-white' +
      ' focus-visible:outline-4 focus-visible:outline-offset-0 focus-visible:outline-white/40',
  ),
  secondary: cn(
    'bg-green-300 hover:bg-green-200' +
      ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-300/40',
  ),
  'secondary-inverted': cn(
    'bg-green-800 hover:bg-green-700 text-white' +
      ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-800/40',
  ),
};

type CallToActionVariant = keyof typeof variantStyles;

export interface CallToActionProps extends ComponentPropsWithoutRef<typeof Anchor> {
  href: string;
  variant: CallToActionVariant;
}

/**
 * This is `Button` in the new Hive brand design system.
 * TODO: Move it to the components library?
 */
export function CallToAction({ className, variant, ...rest }: CallToActionProps) {
  return (
    <Anchor
      className={cn(
        'relative block w-fit rounded-lg',
        'text-green-1000 px-6 py-3 font-medium leading-6',
        'focus-visible:ring-0 focus-visible:ring-offset-0',
        '[&:hover>:first-child]:inset-[-1px] [&:hover>:first-child]:rounded-[9px]',
        variantStyles[variant],
        className,
      )}
      {...rest}
    >
      <div className="absolute inset-0 rounded-lg border border-green-800 bg-inherit" />
      <div className="relative flex flex-row items-center gap-2">{rest.children}</div>
    </Anchor>
  );
}
