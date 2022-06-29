import { ReactElement } from 'react';
import { Item, RadioGroupItemProps, RadioGroupProps, Root } from '@radix-ui/react-radio-group';
import clsx from 'clsx';

export const RadioGroup = ({ children, className, ...props }: RadioGroupProps): ReactElement => {
  return (
    <Root className={clsx('flex flex-col justify-items-stretch gap-4', className)} {...props}>
      {children}
    </Root>
  );
};

export const Radio = ({ children, className, ...props }: RadioGroupItemProps): ReactElement => {
  return (
    <Item
      className={clsx(
        `
        radix-state-checked:border-orange-500
        hover:border-orange-500/50
        relative
        overflow-hidden
        rounded-sm
        border
        text-left
        focus:ring
        `,
        className
      )}
      {...props}
    >
      {children}
    </Item>
  );
};
