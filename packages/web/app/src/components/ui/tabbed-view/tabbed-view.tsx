import { type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { TabStrip, type TabItem } from '../primitives/tabs/tabs';

// Hides the outgoing panel the moment it starts ending, as the tabs primitive does.
const panelVariants = cva('outline-none data-[ending-style]:hidden', {
  variants: {
    bodyPadding: {
      default: 'p-5',
      // For a view that runs edge to edge: a code view, a list of rows.
      none: '',
    },
  },
});

export type TabbedViewItem = TabItem & {
  /** The view, in the body. */
  content: ReactNode;
};

type TabbedViewProps = {
  items: readonly TabbedViewItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  bodyPadding?: 'default' | 'none';
  attrs?: Record<string, string>;
};

export function TabbedView({
  items,
  value,
  defaultValue,
  onValueChange,
  bodyPadding = 'default',
  attrs,
}: TabbedViewProps) {
  return (
    <BaseTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={next => onValueChange?.(String(next))}
      className="overflow-hidden rounded-md border border-line bg-neutral-1 dark:bg-neutral-2"
      {...attrs}
    >
      <div className="flex items-center border-b border-line bg-surface-card">
        <TabStrip items={items} variant="header" activeValue={value} />
      </div>
      {items.map(item => (
        <BaseTabs.Panel
          key={item.value}
          value={item.value}
          className={panelVariants({ bodyPadding })}
        >
          {item.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
