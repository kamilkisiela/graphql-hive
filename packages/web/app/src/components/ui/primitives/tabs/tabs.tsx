import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { Tooltip } from '../floating/tooltip/tooltip';
import { focusRingQuiet } from '../shared-styles';
import * as styles from './tabs.css';

export type TabsVariant = 'underline' | 'header';
export type TabsSize = 'default' | 'sm';
export type TabsOrientation = 'horizontal' | 'vertical';

export type TabItem = {
  value: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  /** Shown on hover, disabled tabs included, so a tab can say why it cannot be picked. */
  tooltip?: ReactNode;
  /** The panel. Optional: a page that renders the view itself below the tabs leaves it out. */
  content?: ReactNode;
  /** Test hooks and the like, landed on the tab button. */
  attrs?: Record<string, string>;
};

type TabsProps = {
  items: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `header` is the strip in TabbedView's band, at the band's height. */
  variant?: TabsVariant;
  size?: TabsSize;
  /** `vertical` stacks the tabs in a column with the panels beside them. */
  orientation?: TabsOrientation;
  attrs?: Record<string, string>;
};

const rootVariants = lenient(styles.rootVariants);

/**
 * A horizontal strip scrolls sideways once its tabs outgrow it, with the scrollbar hidden the way
 * tab strips usually are; the arrow keys still reach every tab. Inline-size containment keeps the
 * tabs from counting toward the width of the flex columns above, which would otherwise stretch
 * to fit them and push the page sideways instead. A scroll container clips on both axes, so the
 * wrapper pads by the focus ring's reach (4px) plus the indicator's pixel below the border, and
 * pulls the same back with negative margins.
 */
const scrollerVariants = lenient(styles.scrollerVariants);

const listVariants = lenient(styles.listVariants);

const tabVariants = cva(
  cn(
    'relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap font-medium transition-colors',
    'text-fg-secondary hover:text-fg data-[active]:text-accent',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    'rounded-sm',
    focusRingQuiet,
  ),
  {
    variants: {
      variant: {
        underline: 'focus-visible:outline-offset-2',
        // The band's frame clips outside its edge, so the ring sits inside the tab instead.
        header: 'h-full focus-visible:-outline-offset-2',
      },
      // Padding and text size are set per variant and size pair below: cva concatenates, so an
      // element must never carry two utilities for one property.
      size: {
        default: '',
        sm: '',
      },
      orientation: {
        horizontal: '',
        vertical: 'justify-start',
      },
    },
    compoundVariants: [
      { variant: 'underline', size: 'default', class: 'px-3 py-2 text-sm' },
      { variant: 'underline', size: 'sm', class: 'px-2.5 py-1.5 text-xs' },
      { variant: 'header', size: 'default', class: 'px-2.5 py-0 text-xs' },
      { variant: 'header', size: 'sm', class: 'px-2 py-0 text-xs' },
      { variant: 'underline', orientation: 'horizontal', class: '-mb-px' },
      { variant: 'underline', orientation: 'vertical', class: '-ml-px' },
    ],
  },
);

const indicatorVariants = lenient(styles.indicatorVariants);

// Base UI keeps the outgoing panel mounted until its exit transition ends, which without an
// animation is still a frame or so of both panels stacked, so hide it the moment it starts ending.
const panelVariants = lenient(styles.panelVariants);

const iconSize = { default: 'size-4', sm: 'size-3.5' } as const;

export function TabStrip({
  items,
  variant = 'underline',
  size = 'default',
  orientation = 'horizontal',
  activeValue,
}: Pick<TabsProps, 'items' | 'variant' | 'size' | 'orientation'> & {
  /** The controlled value, so a tab picked from outside the strip is scrolled into view. */
  activeValue?: string;
}) {
  const icon = variant === 'header' ? iconSize.sm : iconSize[size];
  const scrollerRef = useRef<HTMLDivElement>(null);

  // A tab activated from outside the strip, like a service just added to a proposal, can sit
  // past the scroller's edge. Clicks and arrow keys scroll on their own, since focus does.
  // Only the scroller moves: scrollIntoView could drag the page to the strip as well.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = scroller?.querySelector<HTMLElement>('[role="tab"][data-active]');
    if (!scroller || !tab) {
      return;
    }
    const overflow = tab.getBoundingClientRect().right - scroller.getBoundingClientRect().right;
    const underflow = scroller.getBoundingClientRect().left - tab.getBoundingClientRect().left;
    scroller.scrollLeft += overflow > 0 ? overflow : underflow > 0 ? -underflow : 0;
  }, [activeValue]);

  const list = (
    <BaseTabs.List className={listVariants({ variant, orientation })}>
      {items.map(item => {
        const Icon = item.icon;
        const tab = (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={tabVariants({ variant, size, orientation })}
            {...item.attrs}
          >
            {Icon ? <Icon className={cn(icon, styles.tabStripIcon)} /> : null}
            {item.label}
          </BaseTabs.Tab>
        );
        if (item.tooltip == null) {
          return tab;
        }
        // A disabled button fires no pointer events, so the span carries the hover.
        return (
          <Tooltip
            key={item.value}
            trigger={<span className={styles.tabStripSpan}>{tab}</span>}
            content={item.tooltip}
          />
        );
      })}
      <BaseTabs.Indicator className={indicatorVariants({ variant, orientation })} />
    </BaseTabs.List>
  );
  if (orientation === 'vertical') {
    return list;
  }
  return (
    <div ref={scrollerRef} className={scrollerVariants({ orientation })}>
      {list}
    </div>
  );
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = 'underline',
  size = 'default',
  orientation = 'horizontal',
  attrs,
}: TabsProps) {
  return (
    <BaseTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={next => onValueChange?.(String(next))}
      orientation={orientation}
      className={rootVariants({ variant, orientation })}
      {...attrs}
    >
      <TabStrip
        items={items}
        variant={variant}
        size={size}
        orientation={orientation}
        activeValue={value}
      />
      {items.map(item =>
        item.content != null ? (
          <BaseTabs.Panel
            key={item.value}
            value={item.value}
            className={panelVariants({ orientation })}
          >
            {item.content}
          </BaseTabs.Panel>
        ) : null,
      )}
    </BaseTabs.Root>
  );
}
