import { FC, ReactElement } from 'react';
import { keyframes } from '@emotion/react';
import {
  Close,
  Content,
  Description,
  DialogDescriptionProps,
  DialogTitleProps,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { css } from 'twin.macro';

import { Button } from '@/components/v2';
import { XIcon } from '@/components/v2/icon';

const overlayShow = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const contentShow = keyframes({
  '0%': { opacity: 0, transform: 'translate(-50%, -48%) scale(.96)' },
  '100%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
});

const Modal: FC<{
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
}> & {
  Title?: FC<DialogTitleProps>;
  Description?: FC<DialogDescriptionProps>;
} = ({ trigger, open, onOpenChange, children, className }) => (
  <Root open={open} onOpenChange={onOpenChange}>
    <Trigger asChild>{trigger}</Trigger>
    <Portal>
      <Overlay
        className="fixed inset-0 z-50 bg-gray-800/80"
        css={css`
          @media (prefers-reduced-motion: no-preference) {
            animation: ${overlayShow} 300ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        `}
      >
        <Content
          className={clsx(
            `
            relative
            top-1/2
            left-1/2
            max-h-[95%]
            w-[450px]
            max-w-[95%]
            overflow-auto
            rounded-md
            bg-black
            p-7`,
            className
          )}
          css={css`
            box-shadow: hsl(206 22% 7% / 35%) 0 10px 38px -10px, hsl(206 22% 7% / 20%) 0 10px 20px -15px;
            transform: translate(-50%, -50%);
            @media (prefers-reduced-motion: no-preference) {
              animation: ${contentShow} 300ms cubic-bezier(0.16, 1, 0.3, 1);
            }
          `}
        >
          {children}

          <Close asChild>
            <Button className="hover:text-orange-500 absolute top-5 right-5 text-gray-500 hover:border-gray-500">
              <XIcon />
            </Button>
          </Close>
        </Content>
      </Overlay>
    </Portal>
  </Root>
);

Modal.Title = ({ className, children, ...props }) => {
  return (
    <Title className={clsx('text-2xl font-extrabold', className)} {...props}>
      {children}
    </Title>
  );
};

Modal.Description = ({ children, className, ...props }) => {
  return (
    <Description className={clsx('text-sm font-medium text-gray-500', className)} {...props}>
      {children}
    </Description>
  );
};

export { Modal };
