import React from 'react';
import clsx from 'clsx';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { CaretDownIcon, CrossCircledIcon } from '@radix-ui/react-icons';

interface Option {
  value: string;
  label: string;
}

export function Combobox(
  props: React.PropsWithoutRef<{
    name: string;
    placeholder: string;
    options: readonly Option[];
    value?: readonly Option[];
    onChange: (value: readonly Option[]) => void;
    onBlur: (el: unknown) => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    creatable?: boolean;
  }>,
) {
  const Comp = props.creatable ? CreatableSelect : Select;

  return (
    <Comp
      name={props.name}
      className={props.className}
      components={{
        ClearIndicator: compProps => (
          <components.ClearIndicator {...compProps}>
            <CrossCircledIcon />
          </components.ClearIndicator>
        ),
        DropdownIndicator: compProps => (
          <components.DropdownIndicator {...compProps}>
            <CaretDownIcon />
          </components.DropdownIndicator>
        ),
        NoOptionsMessage: compProps => (
          <components.NoOptionsMessage {...compProps}>
            <div className="text-gray-500 text-xs">
              {props.creatable ? 'Start typing to add values' : 'No options'}
            </div>
          </components.NoOptionsMessage>
        ),
      }}
      classNames={{
        control: () => clsx('bg-gray-800 border-gray-800 hover:border-orange-800 shadow-none'),
        valueContainer: () => clsx('bg-gray-800 rounded-xl'),
        indicatorsContainer: () => clsx('bg-gray-800 rounded-xl'),
        container: () => clsx('bg-gray-800 rounded-xl shadow-lg text-sm'),
        menu: () => clsx('bg-gray-800 rounded-xl shadow-lg text-xs'),
        menuList: () => clsx('bg-gray-800 rounded-lg text-xs'),
        option: () => clsx('bg-gray-800 hover:bg-gray-700 text-xs cursor-pointer'),
        placeholder: () => clsx('text-gray-500 text-xs'),
        input: () => clsx('text-gray-500 text-xs'),
        multiValue: () => clsx('text-gray-500 text-xs bg-gray-200 font-bold'),
        multiValueRemove: () => clsx('text-gray-500 text-xs hover:bg-gray-300 hover:text-gray-700'),
      }}
      closeMenuOnSelect={false}
      value={props.value}
      isMulti
      options={props.options}
      placeholder={props.placeholder}
      onChange={props.onChange as any}
      isDisabled={props.disabled}
      onBlur={props.onBlur}
      isLoading={props.loading}
    />
  );
}
