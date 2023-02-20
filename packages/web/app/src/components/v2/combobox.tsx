import React from 'react';
import Select, { StylesConfig } from 'react-select';

interface Option {
  value: string;
  label: string;
}

const styles: StylesConfig = {
  control: styles => ({
    ...styles,
    backgroundColor: '#24272E',
    borderWidth: 1,
    borderColor: '#5f6169',
  }),
  multiValue: styles => ({
    ...styles,
    backgroundColor: '#4B5563',
    color: '#fff',
  }),
  multiValueLabel: styles => ({
    ...styles,
    color: '#fff',
  }),
  multiValueRemove: styles => ({
    ...styles,
    color: '#6B7280',
    ':hover': {
      backgroundColor: '#6B7280',
      color: '#fff',
    },
  }),
  option: styles => ({
    ...styles,
    color: '#fff',
    fontSize: '14px',
    backgroundColor: '#24272E',
    ':hover': {
      backgroundColor: '#5f6169',
    },
  }),
  menu: styles => ({
    ...styles,
    backgroundColor: '#24272E',
  }),
};

export function Combobox(
  props: React.PropsWithoutRef<{
    name: string;
    options: readonly Option[];
    value?: readonly Option[];
    onChange: (value: readonly Option[]) => void;
    onBlur: (el: unknown) => void;
    disabled?: boolean;
    loading?: boolean;
  }>,
) {
  return (
    <Select
      name={props.name}
      closeMenuOnSelect={false}
      value={props.value}
      isMulti
      options={props.options}
      styles={styles}
      onChange={props.onChange as any}
      isDisabled={props.disabled}
      onBlur={props.onBlur}
      isLoading={props.loading}
    />
  );
}
