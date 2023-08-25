import { ReactElement } from 'react';
import clsx from 'clsx';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { SwitchProps } from '@radix-ui/react-switch';

export const Switch = ({ className, disabled, ...props }: SwitchProps): ReactElement => {
  return (
    <SwitchPrimitive.Root
      className={clsx(
        'relative h-[25px] w-[45px] rounded-full bg-gray-800 focus:ring  disabled:cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          `
          radix-state-checked:translate-x-5
          radix-state-checked:bg-orange-500
          hover:radix-state-checked:border-orange-800
          block
          h-[25px]
          w-[25px]
          rounded-full
          border-2
          border-transparent
          bg-gray-500
          transition-all
        `,
          !disabled && 'hover:border-gray-700',
        )}
      />
    </SwitchPrimitive.Root>
  );
};
