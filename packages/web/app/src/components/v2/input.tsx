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
    onClear?: () => void;
  } & Omit<ComponentProps<'input'>, 'prefix' | 'size'>
>(
  (
    {
      //
      placeholder,
      prefix,
      suffix,
      size = 'large',
      type = 'text',
      isInvalid,
      className,
      onClear,
      ...props
    },
    forwardedRef,
  ) => {
    return (
      <div
        ref={forwardedRef}
        className={clsx(
          `
        relative
        flex
        items-center
        gap-4
        rounded-sm
        bg-gray-800
        text-sm
        font-medium
        border
        border-gray-700
        focus-within:ring`,
          isInvalid ? 'text-red-500 caret-white ring-red-500' : 'text-white',
          {
            large: 'h-[50px] py-[18px] px-4',
            medium: 'py-2.5 px-4',
            small: 'py-[5px] px-3',
          }[size],
          onClear && 'pr-1',
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

        {props.value && onClear ? (
          <button
            aria-label="Reset"
            onClick={onClear}
            className="hover:bg-gray-700/50 p-0.5 rounded transition-colors"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
              height="16"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"
              />
            </svg>
          </button>
        ) : null}
      </div>
    );
  },
);
