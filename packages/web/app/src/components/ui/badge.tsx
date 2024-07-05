import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        gray: 'border-transparent bg-gray-800 text-secondary-foreground hover:bg-800/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const badgeRoundedVariants = cva(
  'inline-block rounded-full mx-1 border-[3px] p-[3px] align-middle text-xs font-bold leading-none text-white',
  {
    variants: {
      color: {
        red: 'border-red-900 bg-red-500',
        yellow: 'border-yellow-900 bg-yellow-500',
        green: 'border-green-900 bg-green-500',
        gray: 'border-gray-900 bg-gray-500',
        orange: 'border-orange-900 bg-orange-500',
      },
    },
    defaultVariants: {
      color: 'green',
    },
  },
);

export interface BadgeRoundedProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeRoundedVariants> {
  color: 'red' | 'yellow' | 'green' | 'gray' | 'orange';
}

function BadgeRounded({ className, color, ...props }: BadgeRoundedProps) {
  return <div className={cn(badgeRoundedVariants({ color }), className)} {...props} />;
}

export { Badge, BadgeRounded, badgeRoundedVariants, badgeVariants };
