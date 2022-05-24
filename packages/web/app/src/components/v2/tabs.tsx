import { FC, forwardRef } from 'react';
import {
  Content,
  List,
  Root,
  TabsContentProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
  Trigger,
} from '@radix-ui/react-tabs';
import clsx from 'clsx';

const Tabs: FC<TabsProps> & {
  List?: FC<TabsListProps>;
  Trigger?: FC<TabsTriggerProps & { hasBorder?: boolean }>;
  Content?: FC<TabsContentProps>;
} = Root;

Tabs.List = ({ children, className, ...props }) => (
  <List
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
  </List>
);

Tabs.Trigger = forwardRef(
  (
    { children, className, hasBorder = true, ...props },
    forwardedRef /* when has asChild prop */
  ) => (
    <Trigger
      ref={forwardedRef as any}
      className={clsx(
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
    </Trigger>
  )
);

Tabs.Content = ({ children, className, ...props }) => (
  <Content className={clsx('py-7', className)} {...props}>
    {children}
  </Content>
);

export { Tabs };
