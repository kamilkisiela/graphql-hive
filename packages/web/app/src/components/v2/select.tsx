import { ComponentProps, ReactElement } from 'react';
import clsx from 'clsx';
import { ArrowDownIcon } from '@/components/v2/icon';

export function Select({
  options,
  className,
  value,
  isInvalid,
  ...props
}: ComponentProps<'select'> & {
  options?: { name: string; value: string }[];
  isInvalid?: boolean;
}): ReactElement {
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
          isInvalid
            ? 'text-red-500 border-red-500'
            : ['border-transparent', value ? 'text-white' : 'text-gray-500'],
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
}
