import { ComponentProps, ElementRef, forwardRef, ReactNode } from 'react';
import { clsx } from 'clsx';
import * as D from '@radix-ui/react-dialog';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button } from './button';

type SheetContentProps = {
  open: boolean;
  onOpenChange(): void;
  position?: 'left' | 'right';
  children: ReactNode;
  width?: string | number;
};

const Wrapper = forwardRef<ElementRef<typeof D.Content>, SheetContentProps>(
  ({ children, open, onOpenChange, position = 'right', width = 400, ...props }, forwardedRef) => {
    return (
      <D.Root open={open} onOpenChange={onOpenChange}>
        <D.Portal>
          <D.Overlay className="z-50 fixed inset-0 bg-gray-800/80 radix-state-open:animate-fade-in radix-state-closed:animate-fade-out" />
          <D.Content
            {...props}
            ref={forwardedRef}
            className={clsx(
              'fixed inset-y-0 bg-black z-50 px-4',
              {
                left: 'transform-[translate3d(-100%,0,0)] left-0',
                right: 'transform-[translate3d(100%,0,0)] right-0',
              }[position],
            )}
            style={{ width }}
          >
            {children}
            <D.Close asChild className="absolute right-2 top-2">
              <Button>
                <Cross1Icon className="h-5 w-auto" />
              </Button>
            </D.Close>
          </D.Content>
        </D.Portal>
      </D.Root>
    );
  },
);

export const Drawer = Object.assign(Wrapper, {
  Title({ children, className, ...props }: ComponentProps<typeof D.Title>) {
    return (
      <D.Title className={clsx('py-4 px-2 text-2xl font-semibold', className)} {...props}>
        {children}
      </D.Title>
    );
  },
});
