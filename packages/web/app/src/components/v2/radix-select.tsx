import { ReactElement } from 'react';
import { clsx } from 'clsx';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import * as S from '@radix-ui/react-select';
import { SelectContentProps } from '@radix-ui/react-select';
import { RadixButton } from './radix-button';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function RadixSelect<T extends string>({
  className,
  options,
  onChange,
  defaultValue,
  value,
  position,
  name,
  placeholder,
  isDisabled,
}: {
  multiple?: boolean;
  className?: string;
  options: SelectOption[];
  onChange: (value: T) => void;
  defaultValue?: T;
  value?: T;
  placeholder?: string;
  position?: SelectContentProps['position'];
  name?: string;
  isDisabled?: boolean;
}): ReactElement {
  return (
    <S.Root
      defaultValue={defaultValue}
      onValueChange={onChange}
      value={value}
      name={name}
      disabled={isDisabled}
    >
      <S.Trigger asChild aria-label="">
        <RadixButton className={className}>
          <S.Value placeholder={placeholder} />
          {isDisabled ? null : (
            <S.Icon className="ml-2">
              <ChevronDownIcon />
            </S.Icon>
          )}
        </RadixButton>
      </S.Trigger>
      <S.Content
        className="z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800"
        position={position}
      >
        <S.ScrollUpButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
          <ChevronUpIcon />
        </S.ScrollUpButton>
        <S.Viewport>
          <S.Group>
            {options.map(({ value, label, disabled }) => (
              <S.Item
                disabled={disabled}
                key={value}
                value={value}
                className={clsx(
                  'relative flex items-center rounded-md px-8 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100 dark:text-gray-300 dark:focus:bg-gray-900',
                  'radix-disabled:opacity-50',
                  'cursor-pointer select-none focus:outline-none',
                )}
              >
                <S.ItemText>{label}</S.ItemText>
                <S.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <CheckIcon />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Group>
        </S.Viewport>
        <S.ScrollDownButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
          <ChevronDownIcon />
        </S.ScrollDownButton>
      </S.Content>
    </S.Root>
  );
}
