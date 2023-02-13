import { ComponentProps, forwardRef, ReactElement } from 'react';
import clsx from 'clsx';

export const Input = forwardRef<
  any,
  {
    placeholder?: string;
    prefix?: ReactElement;
    suffix?: ReactElement;
    size?: 'large' | 'medium' | 'small';
    isInvalid?: boolean;
  } & Omit<ComponentProps<'input'>, 'prefix' | 'size'>
>(
  (
    { prefix, suffix, placeholder, type, className, size = 'large', isInvalid, ...props },
    forwardedRef,
  ) => {
    return (
      <div
        ref={forwardedRef}
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
          className,
        )}
      >
        {prefix}

        <input
          className="w-full bg-transparent placeholder:text-gray-500 disabled:cursor-not-allowed"
          placeholder={placeholder}
          type={type}
          style={{ fontWeight: 'inherit' }}
          {...props}
        />

        {suffix}
      </div>
    );
  },
);

// ({
//   prefix,
//   suffix,
//   placeholder,
//   type,
//   className,
//   size = 'large',
//   isInvalid,
//   ...props
// }: {
//   placeholder?: string;
//   prefix?: ReactElement;
//   suffix?: ReactElement;
//   size?: 'large' | 'medium' | 'small';
//   isInvalid?: boolean;
// } & Omit<ComponentProps<'input'>, 'prefix' | 'size'>): ReactElement => {

// };
