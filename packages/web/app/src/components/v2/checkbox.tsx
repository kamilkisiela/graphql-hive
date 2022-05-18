import { ReactElement } from 'react';
import { CheckboxProps, Indicator, Root } from '@radix-ui/react-checkbox';

export const Checkbox = (props: CheckboxProps): ReactElement => {
  return (
    <Root
      className="
      border-orange-500
      text-orange-500
      flex
      h-5
      w-5
      shrink-0
      items-center
      justify-center
      rounded-[5px]
      border
      bg-gray-800
      focus:ring
      disabled:cursor-not-allowed
      disabled:border-gray-900
    "
      {...props}
    >
      <Indicator className="h-3.5 w-3.5 rounded-[2px] bg-current" />
    </Root>
  );
};
