import { ComponentProps, ReactElement } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import clsx from 'clsx';
import { VscCheck, VscChevronDown, VscChevronUp } from 'react-icons/vsc';

import { ArrowDownIcon } from '@/components/v2/icon';

export function RadixSelect<T extends string>(props: {
  placeholder: string;
  options: Array<{
    label: string;
    value: T;
  }>;
  className?: string;
  onChange: (value: T) => void;
  defaultValue?: T;
  value?: T;
  name?: string;
}) {
  return (
    <div className={clsx('inline-block', props.className)}>
      <SelectPrimitive.Root
        name={props.name}
        onValueChange={props.onChange}
        value={props.value}
        defaultValue={props.defaultValue}
      >
        <SelectPrimitive.SelectTrigger className="inline-flex items-center justify-center gap-2 rounded bg-gray-800 py-2 px-4 hover:bg-gray-700">
          <SelectPrimitive.SelectValue placeholder={props.placeholder} />
          <SelectPrimitive.SelectIcon>
            <VscChevronDown />
          </SelectPrimitive.SelectIcon>
        </SelectPrimitive.SelectTrigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="overflow-hidden rounded bg-gray-800">
            <SelectPrimitive.ScrollUpButton
              className="flex w-full cursor-default items-center justify-center"
              style={{ height: 32 }}
            >
              <VscChevronUp />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-2">
              {props.options.map(option => (
                <SelectPrimitive.Item
                  value={option.value}
                  key={option.value}
                  className="relative cursor-default rounded py-2 pl-8 hover:bg-gray-700"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator
                    className="absolute inset-y-0 left-0 inline-flex h-full items-center justify-center"
                    style={{ width: 25 }}
                  >
                    <VscCheck />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton
              className="flex w-full cursor-default items-center justify-center"
              style={{ height: 32 }}
            >
              <VscChevronDown />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

export const Select = ({
  options,
  className,
  value,
  isInvalid,
  ...props
}: ComponentProps<'select'> & {
  options: { name: string; value: string }[];
  isInvalid?: boolean;
}): ReactElement => {
  return (
    <div className={clsx('relative w-full', className)}>
      <ArrowDownIcon className="absolute right-4 translate-y-1/2 text-gray-500" />
      <select
        value={value}
        className={clsx(
          `
          h-[50px]
          w-full
          text-ellipsis
          rounded-sm
          border
          bg-gray-800
          pl-4
          pr-10
          text-sm
          font-medium
          transition
          focus:ring
          active:bg-gray-900
        `,
          isInvalid ? 'text-red-500' : value ? 'text-white' : 'text-gray-500',
          isInvalid ? 'border-red-500' : 'border-transparent'
        )}
        {...props}
      >
        {props.placeholder ? <option value="">{props.placeholder}</option> : null}
        {options?.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
};
