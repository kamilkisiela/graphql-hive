import { ReactElement } from 'react';
import { CheckboxProps, Indicator, Root } from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';

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
      disabled:cursor-not-allowed
      disabled:border-gray-900
      hover:border-orange-700
    "
      {...props}
    >
      <Indicator className="h-full w-full bg-current items-center flex justify-center">
        <CheckIcon className="text-black" />
      </Indicator>
    </Root>
  );
};
