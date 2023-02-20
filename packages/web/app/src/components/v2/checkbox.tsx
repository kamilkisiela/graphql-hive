import { ReactElement } from 'react';
import { CheckboxProps, Indicator, Root } from '@radix-ui/react-checkbox';

export const Checkbox = (props: CheckboxProps): ReactElement => {
  return (
    <Root
      className="
      flex
      h-5
      w-5
      shrink-0
      items-center
      justify-center
      rounded-sm
      border
      border-orange-500
      bg-gray-800
      text-orange-500
      focus:ring
      disabled:cursor-not-allowed
      disabled:border-gray-900
    "
      {...props}
    >
      <Indicator className="h-3.5 w-3.5 rounded-sm bg-current" />
    </Root>
  );
};
