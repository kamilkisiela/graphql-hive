import { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/v2';
import { XIcon } from '@/components/v2/icon';
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

const widthBySize = {
  sm: clsx('w-[450px]'),
  md: clsx('w-[600px]'),
  lg: clsx('w-[800px]'),
};

const Modal = ({
  trigger,
  open,
  onOpenChange,
  children,
  className,
  size = 'sm',
}: {
  children: ReactNode;
  trigger?: ReactElement;
  open?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
}): ReactElement => (
  <Root open={open} onOpenChange={onOpenChange}>
    <Trigger asChild>{trigger}</Trigger>
    <Portal>
      <Overlay className="hive-modal-overlay fixed inset-0 z-50 bg-gray-800/80">
        <Content
          className={clsx(
            `
            hive-modal
            relative
            top-1/2
            left-1/2
            max-h-[95%]
            max-w-[95%]
            overflow-auto
            rounded-md
            bg-black
            p-7`,
            className,
            widthBySize[size],
          )}
        >
          {children}

          <Close asChild>
            <Button className="absolute top-5 right-5 text-gray-500 hover:border-gray-500 hover:text-orange-500">
              <XIcon />
            </Button>
          </Close>
        </Content>
      </Overlay>
    </Portal>
  </Root>
);

Modal.Title = ({
  className,
  children,
  ...props
}: DialogTitleProps & { children: ReactNode }): ReactElement => {
  return (
    <Title className={clsx('text-2xl font-extrabold', className)} {...props}>
      {children}
    </Title>
  );
};

Modal.Description = ({
  children,
  className,
  ...props
}: DialogDescriptionProps & { children: ReactNode }): ReactElement => {
  return (
    <Description className={clsx('text-sm font-medium text-gray-500', className)} {...props}>
      {children}
    </Description>
  );
};

export { Modal };
