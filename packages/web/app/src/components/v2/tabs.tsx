import { FC, forwardRef } from 'react';
import {
  Content as TabsContent,
  List as TabsList,
  Root,
  TabsContentProps,
  TabsListProps,
  TabsTriggerProps,
  Trigger as TabsTrigger,
} from '@radix-ui/react-tabs';
import clsx from 'clsx';

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
      className
    )}
    {...props}
  >
    {children}
  </TabsList>
);

const Trigger: FC<TabsTriggerProps & { hasBorder?: boolean }> = forwardRef(
  ({ children, className, hasBorder = true, ...props }, forwardedRef /* when has asChild prop */) => (
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
  pb-3`
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  )
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
