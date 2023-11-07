import { ComponentProps, ReactElement, ReactNode } from 'react';
import { cx } from 'class-variance-authority';
import { clsx } from 'clsx';
import * as A from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';

type AccordionProps = Partial<
  Pick<ComponentProps<typeof A.Root>, 'disabled' | 'value' | 'onValueChange'>
>;

function Wrapper({
  children,
  type = 'single',
  defaultValue,
  ...props
}: {
  defaultValue?: string | Array<string>;
  children: ReactNode;
  className?: string;
} & AccordionProps &
  (
    | { type?: 'single'; defaultValue?: string }
    | { type: 'multiple'; defaultValue?: Array<string> }
  )): ReactElement {
  return (
    // @ts-expect-error docs say array is okay
    <A.Root
      {...(props as any[])}
      type={type}
      defaultValue={defaultValue}
      collapsible
      className={cx('w-full', props.className)}
      data-cy="accordion"
    >
      {children}
    </A.Root>
  );
}

function Item({
  value,
  className,
  children,
  ...props
}: {
  value: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <A.Item {...props} value={value} className={clsx('w-full rounded-md', className)}>
      {children}
    </A.Item>
  );
}

function Header({
  children,
  className,
  triggerClassName,
}: {
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
}): ReactElement {
  return (
    <A.Header className={clsx('w-full', className)}>
      <A.Trigger
        className={clsx(
          'group',
          'radix-state-open:rounded-t-lg radix-state-closed:rounded-lg',
          'focus:outline-none',
          'inline-flex w-full items-center justify-between px-4 py-2 text-left',
          triggerClassName,
        )}
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{children}</span>
        <ChevronDownIcon
          className={clsx(
            'ml-2 h-5 w-5 shrink-0 text-gray-700 ease-in-out dark:text-gray-400',
            'group-radix-state-open:rotate-180 group-radix-state-open:duration-300',
          )}
        />
      </A.Trigger>
    </A.Header>
  );
}

function Content({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <A.Content className={clsx('w-full rounded-b-lg px-4 pb-3 pt-1', className)}>
      <div className="text-sm text-gray-700 dark:text-gray-400">{children}</div>
    </A.Content>
  );
}

export const Accordion = Object.assign(Wrapper, { Item, Header, Content });
