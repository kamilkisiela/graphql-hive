import { FC } from 'react';
import { keyframes } from '@emotion/react';
import {
  Content as DropDownMenuContent,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuSeparatorProps,
  DropdownMenuTriggerItemProps,
  Item as DropDownMenuItem,
  Label,
  Root,
  Separator as DropDownMenuSeparator,
  Trigger,
  TriggerItem as DropDownMenuTriggerItem,
} from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { css } from 'twin.macro';

const Content: FC<DropdownMenuContentProps> = ({ children, className, ...props }) => (
  <DropDownMenuContent
    className={clsx(
      `
    flex
    flex-col
    gap-1
    rounded-md
    bg-gray-800
    p-[13px]
    text-sm
    font-semibold
    text-gray-300
  `,
      className,
    )}
    css={css`
      box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
      @media (prefers-reduced-motion: no-preference) {
        animation-duration: 400ms;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform, opacity;
        &[data-state='open'] {
          &[data-side='top'],
          &[data-side='left'] {
            animation-name: ${keyframes`
              from {
                opacity: 0;
                transform: translateY(-2px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            `};
          }

          &[data-side='bottom'],
          &[data-side='right'] {
            animation-name: ${keyframes`
              from {
                opacity: 0;
                transform: translateY(2px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            `};
          }
        }
      }
    `}
    {...props}
  >
    {children}
  </DropDownMenuContent>
);

const Item: FC<DropdownMenuItemProps> = ({ children, className, ...props }) => (
  <DropDownMenuItem
    className={clsx(
      `
      flex
      cursor-pointer
      items-center
      gap-4
      rounded-md
      py-2.5
      px-2
      transition
      hover:bg-gray-500/50
      hover:text-white
      focus:bg-gray-500/50
      focus:text-white`,
      className,
    )}
    {...props}
  >
    {children}
  </DropDownMenuItem>
);

const TriggerItem: FC<DropdownMenuTriggerItemProps> = ({ children, className, ...props }) => (
  <DropDownMenuTriggerItem
    className={clsx(
      `
      radix-state-open:sepia
      radix-state-open:bg-orange-500/40
      flex
      cursor-pointer
      items-center
      gap-4
      rounded-md
      py-2.5
      px-2
      transition
      hover:bg-gray-500/50
      hover:text-white
      focus:bg-gray-500/50
      focus:text-white`,
      className,
    )}
    {...props}
  >
    {children}
  </DropDownMenuTriggerItem>
);

const Separator: FC<DropdownMenuSeparatorProps> = ({ className, asChild }) => (
  <DropDownMenuSeparator className={clsx('h-px bg-gray-700/50', className)} asChild={asChild} />
);

export const DropdownMenu = Object.assign(Root, {
  Separator,
  Trigger,
  Label,
  Content,
  TriggerItem,
  Item,
});
