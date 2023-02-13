import { ComponentProps, forwardRef } from 'react';
import clsx from 'clsx';
import { css } from '@emotion/react';
import * as Toolbar from '@radix-ui/react-toolbar';

type ButtonProps = Omit<ComponentProps<'button'>, 'size'> & {
  danger?: boolean;
  variant?: 'primary' | 'secondary' | 'default' | 'link';
  size?: 'large' | 'medium' | 'small';
  block?: boolean;
  rotate?: number;
  as?: 'a';
  href?: string;
};

export const Button = forwardRef<any, ButtonProps>(
  (
    {
      children,
      danger = false,
      variant = 'default',
      size = 'medium',
      block = false,
      rotate = 0,
      className,
      as,
      ...props
    },
    forwardedRef,
  ) => {
    const TagToUse = as || Toolbar.Button;

    return (
      <Toolbar.Root asChild>
        <TagToUse
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- TODO: fix error Type 'string' is not assignable to type 'Ref<HTMLButtonElement>
          // @ts-ignore
          ref={forwardedRef} // required by DropdownMenu.Trigger with asChild prop
          className={clsx(
            `
              transition
              focus:ring
              disabled:cursor-not-allowed
              disabled:bg-gray-800
              disabled:text-[#c4c4c4]
              disabled:brightness-100
            `,
            block && 'w-full justify-center',
            variant !== 'link' &&
              {
                small: 'rounded-sm p-1',
                medium: 'rounded-sm p-2',
                large: 'rounded-md p-3',
              }[size],
            danger
              ? 'bg-red-500 text-white hover:brightness-110 active:bg-red-600'
              : {
                  primary: 'bg-orange-600 text-white hover:brightness-110 active:bg-orange-700',
                  secondary:
                    'bg-gray-800 text-gray-500 hover:text-orange-600 hover:brightness-110 active:bg-gray-900',
                  default:
                    'bg-transparent text-gray-500 hover:border-gray-800 hover:text-orange-600',
                  link: 'text-orange-600 hover:underline',
                }[variant],
            variant !== 'link' &&
              'inline-flex items-center border border-transparent text-sm font-bold',
            className,
            rotate > 0 && 'radix-state-open:border-gray-800 radix-state-open:text-orange-600',
          )}
          css={css`
            &[data-state='open'] svg {
              transform: rotate(${rotate}deg);
              will-change: transform; /* will-change-transform */

              /* transition-transform */
              transition-property: transform;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
            }
          `}
          {...props}
        >
          {children}
        </TagToUse>
      </Toolbar.Root>
    );
  },
);
