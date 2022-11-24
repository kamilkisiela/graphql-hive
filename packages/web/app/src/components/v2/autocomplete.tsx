import React from 'react';
import { StylesConfig } from 'react-select';
import Select from 'react-select';
import { FixedSizeList } from 'react-window';

const height = 40;

function MenuList(props: any) {
  const { options, children, maxHeight, getValue } = props;
  const [value] = getValue();
  const initialOffset = options.indexOf(value) * height;

  return (
    <FixedSizeList
      width="100%"
      height={maxHeight}
      itemCount={children.length}
      itemSize={height}
      initialScrollOffset={initialOffset}
    >
      {({ index, style }) => <div style={style}>{children[index]}</div>}
    </FixedSizeList>
  );
}

interface Option {
  value: string;
  label: string;
}

const styles: StylesConfig = {
  input: styles => ({
    ...styles,
    color: '#fff',
  }),
  control: styles => ({
    ...styles,
    backgroundColor: '#24272E',
    borderWidth: 1,
    borderColor: '#5f6169',
  }),
  singleValue: styles => ({
    ...styles,
    color: '#fff',
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

export function Autocomplete(
  props: React.PropsWithoutRef<{
    placeholder: string;
    options: readonly Option[];
    onChange: (value: Option) => void;
    defaultValue?: Option | null;
    disabled?: boolean;
    loading?: boolean;
  }>,
) {
  return (
    <Select
      options={props.options}
      defaultValue={props.defaultValue}
      styles={styles}
      isSearchable
      closeMenuOnSelect
      onChange={option => props.onChange(option as Option)}
      isDisabled={props.disabled}
      isLoading={props.loading}
      placeholder={props.placeholder}
      components={{
        MenuList,
      }}
    />
  );
}
