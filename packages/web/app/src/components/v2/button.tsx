import { ComponentProps, forwardRef } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import clsx from 'clsx';
import tw, { css } from 'twin.macro';

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
    forwardedRef
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
                small: 'rounded-[5px] p-1',
                medium: 'rounded-[5px] p-2',
                large: 'rounded-[10px] p-3',
              }[size],
            danger
              ? 'bg-red-500 text-white hover:brightness-110 active:bg-red-600'
              : {
                  primary:
                    'bg-orange-500 active:bg-orange-600 text-white hover:brightness-110',
                  secondary:
                    'hover:text-orange-500 bg-gray-800 text-gray-500 hover:brightness-110 active:bg-gray-900',
                  default:
                    'hover:text-orange-500 bg-transparent text-gray-500 hover:border-gray-800',
                  link: 'text-orange-500 hover:underline',
                }[variant],
            variant !== 'link' &&
              'inline-flex items-center border border-transparent text-sm font-bold',
            className
          )}
          css={
            rotate > 0 &&
            css`
              &[data-state='open'] {
                ${tw`border-gray-800 text-orange-500`}
                svg {
                  transform: rotate(${rotate}deg);
                  ${tw`will-change-transform transition-transform`}
                }
              }
            `
          }
          {...props}
        >
          {children}
        </TagToUse>
      </Toolbar.Root>
    );
  }
);
