import React from 'react';
import clsx from 'clsx';
import { ChevronDown, CircleX } from 'lucide-react';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import * as styles from './combobox.css';

interface Option {
  value: string;
  label: string;
}

export function Combobox(
  props: React.PropsWithoutRef<{
    name: string;
    inputId?: string;
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
      inputId={props.inputId}
      className={props.className}
      components={{
        ClearIndicator: compProps => (
          <components.ClearIndicator {...compProps}>
            <CircleX className={styles.comboboxCircleX} />
          </components.ClearIndicator>
        ),
        DropdownIndicator: compProps => (
          <components.DropdownIndicator {...compProps}>
            <ChevronDown className={styles.comboboxChevronDown} />
          </components.DropdownIndicator>
        ),
        NoOptionsMessage: compProps => (
          <components.NoOptionsMessage {...compProps}>
            <div className={styles.comboboxDiv}>
              {props.creatable ? 'Start typing to add values' : 'No options'}
            </div>
          </components.NoOptionsMessage>
        ),
      }}
      classNames={{
        control: () => clsx(styles.comboboxClass),
        valueContainer: () => clsx(styles.comboboxClass2),
        indicatorsContainer: () => clsx(styles.comboboxClass3),
        container: () => clsx(styles.comboboxClass4),
        menu: () => clsx(styles.comboboxClass5),
        menuList: () => clsx(styles.comboboxClass6),
        option: () => clsx(styles.comboboxClass7),
        placeholder: () => clsx(styles.comboboxClass8),
        input: () => clsx(styles.comboboxClass9),
        multiValue: () => clsx(styles.comboboxClass10),
        multiValueRemove: () => clsx(styles.comboboxClass11),
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
