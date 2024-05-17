import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, asChild = false, ...props }, forwardedRef) => {
    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={forwardedRef}
        className={cn('rounded-md border border-gray-800 p-5', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

Card.displayName = 'Card';

export { Card };
