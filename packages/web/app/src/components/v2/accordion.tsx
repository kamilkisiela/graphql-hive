import { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import * as A from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';

function Wrapper({
  defaultValue,
  children,
}: {
  defaultValue?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <A.Root type="single" defaultValue={defaultValue} className="space-y-4 w-full">
      {children}
    </A.Root>
  );
}

function Item({ value, children }: { value: string; children: ReactNode }): ReactElement {
  return (
    <A.Item value={value} className="rounded-lg focus-within:ring w-full">
      {children}
    </A.Item>
  );
}

function Header({ children }: { children: ReactNode }): ReactElement {
  return (
    <A.Header className="w-full">
      <A.Trigger
        className={clsx(
          'group',
          'radix-state-open:rounded-t-lg radix-state-closed:rounded-lg',
          'focus:outline-none',
          'inline-flex w-full items-center justify-between px-4 py-2 text-left',
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

function Content({ children }: { children: ReactNode }): ReactElement {
  return (
    <A.Content className="pt-1 w-full rounded-b-lg px-4 pb-3">
      <div className="text-sm text-gray-700 dark:text-gray-400">{children}</div>
    </A.Content>
  );
}

export const Accordion = Object.assign(Wrapper, { Item, Header, Content });
