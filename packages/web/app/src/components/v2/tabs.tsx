import { forwardRef, ReactElement } from 'react';
import clsx from 'clsx';
import {
  Root,
  Content as TabsContent,
  TabsContentProps,
  List as TabsList,
  TabsListProps,
  Trigger as TabsTrigger,
  TabsTriggerProps,
} from '@radix-ui/react-tabs';

const List = ({ children, className, ...props }: TabsListProps): ReactElement => (
  <TabsList
    className={clsx(
      `
      relative
      flex
      items-center
      text-gray-700
    `,
      className,
    )}
    {...props}
  >
    {children}
  </TabsList>
);

const Trigger = forwardRef<any, Omit<TabsTriggerProps, 'className'> & { hasBorder?: boolean }>(
  ({ children, hasBorder = true, ...props }, forwardedRef /* when has asChild prop */) => (
    <TabsTrigger
      ref={forwardedRef}
      className={clsx(
        '!appearance-none', // unset button styles in Safari
        'text-sm font-medium text-white transition',
        hasBorder
          ? `
            radix-state-active:border-b-orange-500
            cursor-pointer
            border-b-[2px]
            border-b-transparent
            px-4
            py-3
            hover:border-b-orange-900
          `
          : null,
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  ),
);

const Content = ({
  children,
  className,
  noPadding,
  ...props
}: TabsContentProps & { noPadding?: boolean }): ReactElement => (
  <TabsContent className={clsx(noPadding ? undefined : 'py-7', className)} {...props}>
    {children}
  </TabsContent>
);

export const Tabs = Object.assign(Root, {
  Content,
  Trigger,
  List,
});
