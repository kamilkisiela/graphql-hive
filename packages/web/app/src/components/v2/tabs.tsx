import { FC, forwardRef } from 'react';
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

const List: FC<TabsListProps> = ({ children, className, ...props }) => (
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

const Trigger: FC<Omit<TabsTriggerProps, 'className'> & { hasBorder?: boolean }> = forwardRef(
  ({ children, hasBorder = true, ...props }, forwardedRef /* when has asChild prop */) => (
    <TabsTrigger
      ref={forwardedRef as any}
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

const Content: FC<TabsContentProps> = ({ children, className, ...props }) => (
  <TabsContent className={clsx('py-7', className)} {...props}>
    {children}
  </TabsContent>
);

export const Tabs = Object.assign(Root, {
  Content,
  Trigger,
  List,
});
