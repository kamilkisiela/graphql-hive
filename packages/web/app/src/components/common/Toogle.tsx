import React from 'react';
import tw, { styled } from 'twin.macro';

const Option = styled.button(({ selected }: { selected?: boolean }) => [
  tw`
    px-2 py-1
    rounded-md focus:outline-none
    text-sm 
    text-gray-500 
    hover:text-gray-700 dark:hover:text-gray-400
    hover:bg-gray-100 dark:hover:bg-gray-700
  `,
  selected
    ? tw`
      text-white dark:text-black
      hover:text-white dark:hover:text-black
      bg-yellow-500 dark:bg-yellow-300
      hover:bg-yellow-500 dark:hover:bg-yellow-300
    `
    : tw`
      hover:bg-gray-100
    `,
]);

interface ToogleOption<T> {
  value: T;
  label: string;
}

export function TextToggle<T>({
  left,
  right,
  selected,
  onSelect,
}: {
  left: ToogleOption<T>;
  right: ToogleOption<T>;
  selected: T;
  onSelect(selected: T): void;
}) {
  const selectLeft = React.useCallback(() => {
    onSelect(left.value);
  }, []);
  const selectRight = React.useCallback(() => {
    onSelect(right.value);
  }, []);

  const isSelected = ({ value }: ToogleOption<T>) => selected == value;

  return (
    <div tw="flex flex-row p-1 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden space-x-1">
      <Option selected={isSelected(left)} onClick={selectLeft}>
        {left.label}
      </Option>
      <Option selected={isSelected(right)} onClick={selectRight}>
        {right.label}
      </Option>
    </div>
  );
}
