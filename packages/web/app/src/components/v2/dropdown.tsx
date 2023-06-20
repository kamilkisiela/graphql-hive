import React from 'react';
import clsx from 'clsx';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuPrimitive.DropdownMenuTriggerProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.Trigger
      {...props}
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
      `,
        className,
      )}
      ref={forwardedRef}
    >
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
});

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuContentProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...props}
        ref={forwardedRef}
        className={clsx(
          `
          flex
          flex-col
          gap-1
          rounded-md
          p-[13px]
          text-sm
          font-normal
          bg-[#0b0d11]
          text-gray-300
          shadow-lg
          shadow-black
          ring-1 ring-gray-900
        `,
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuSubTriggerProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.SubTrigger
      {...props}
      className={clsx(
        `
        radix-state-open:bg-gray-800/50
        flex
        cursor-pointer
        items-center
        gap-4
        rounded-md
        py-2.5
        px-2
        transition
        hover:bg-gray-800/50
        hover:text-white
        focus:bg-gray-800/50
        focus:text-white
    `,
        className,
      )}
      ref={forwardedRef}
    >
      {children}
    </DropdownMenuPrimitive.SubTrigger>
  );
});
export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuSubContentProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        {...props}
        ref={forwardedRef}
        className={clsx(
          `
          flex
          flex-col
          gap-1
          rounded-md
          p-[13px]
          text-sm
          font-normal
          bg-[#0b0d11]
          text-gray-300
          shadow-lg
          shadow-black
          ring-1 ring-gray-900
        `,
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.SubContent>
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuLabel = DropdownMenuPrimitive.Label;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuItemProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.Item
      {...props}
      ref={forwardedRef}
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
        hover:bg-gray-800/50
        hover:text-white
        focus:bg-gray-800/50
        focus:text-white`,
        className,
      )}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPrimitive.DropdownMenuSeparatorProps
>(({ className, ...props }, forwardedRef) => {
  return (
    <DropdownMenuPrimitive.Separator
      {...props}
      ref={forwardedRef}
      className={clsx(
        `
        my-2
        h-px
        bg-gray-800/50
      `,
        className,
      )}
    />
  );
});
