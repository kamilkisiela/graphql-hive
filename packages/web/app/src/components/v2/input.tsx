import { ComponentProps, ReactElement } from 'react';
import clsx from 'clsx';

export const Input = ({
  prefix,
  suffix,
  placeholder,
  type,
  className,
  size = 'large',
  isInvalid,
  ...props
}: {
  placeholder?: string;
  prefix?: ReactElement;
  suffix?: ReactElement;
  size?: 'large' | 'medium' | 'small';
  isInvalid?: boolean;
} & Omit<ComponentProps<'input'>, 'prefix' | 'size'>): ReactElement => {
  return (
    <div
      className={clsx(
        `
        flex
        items-center
        gap-4
        rounded-sm
        bg-gray-800
        text-sm
        font-medium
        ring-1
        ring-gray-700
        focus-within:ring`,
        isInvalid ? 'text-red-500 caret-white ring-red-500' : 'text-white',
        {
          large: 'h-[50px] py-[18px] px-4',
          medium: 'py-2.5 px-4',
          small: 'py-[5px] px-4',
        }[size],
        className
      )}
    >
      {prefix}

      <input
        // eslint-disable-next-line tailwindcss/migration-from-tailwind-2 -- refactor in tailwindcss v3
        className="w-full bg-transparent placeholder-gray-500 disabled:cursor-not-allowed"
        placeholder={placeholder}
        type={type}
        style={{ fontWeight: 'inherit' }}
        {...props}
      />

      {suffix}
    </div>
  );
};
