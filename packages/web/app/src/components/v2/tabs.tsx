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
      gap-7
      text-xl
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
        `
  radix-state-active:text-white
  font-bold
  transition
  hover:text-white`,
        hasBorder &&
          `
  radix-state-active:border-b-orange-500
  border-b-[5px]
  border-b-transparent
  pb-3`,
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  ),
);

const Content = ({ children, className, ...props }: TabsContentProps): ReactElement => (
  <TabsContent className={clsx('py-7', className)} {...props}>
    {children}
  </TabsContent>
);

export const Tabs = Object.assign(Root, {
  Content,
  Trigger,
  List,
});
