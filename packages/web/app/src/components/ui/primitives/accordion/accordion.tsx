import { type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { focusRingQuiet } from '../shared-styles';

export type AccordionItem = {
  value: string;
  /** Text, or a two-line header, badges, icons. */
  label: ReactNode;
  /** At the far end of the trigger, before the chevron: a count, a status. */
  trailing?: ReactNode;
  /** Beside the trigger, outside it: a menu button. A button cannot nest in a button. */
  action?: ReactNode;
  /** Nothing (`null` or `undefined`) makes a static row: the same header, nothing to open. */
  content?: ReactNode;
  disabled?: boolean;
  /** Test hooks and the like, landed on the item. */
  attrs?: Record<string, string>;
  /** Test hooks on the trigger button itself. */
  triggerAttrs?: Record<string, string>;
};

export type AccordionVariant = 'list' | 'boxed' | 'plain';
export type AccordionSize = 'default' | 'sm';
export type AccordionChevron = 'end' | 'start' | 'none';
export type AccordionTone = 'default' | 'accent';

type AccordionProps = {
  items: readonly AccordionItem[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** More than one item open at once. */
  multiple?: boolean;
  /**
   * `list` draws a hairline under each item, so rows read as a list even one at a time; `boxed`
   * gives each item a card border, spaced apart; `plain` draws nothing, for a lone disclosure.
   */
  variant?: AccordionVariant;
  size?: AccordionSize;
  /** Where the chevron sits. `start` for a disclosure under a form; `none` when the label carries its own icon. */
  chevron?: AccordionChevron;
  /** `accent` calls the trigger out: a disclosure that invites, like Advanced settings, rather than a section. */
  tone?: AccordionTone;
  /** Closed panels stay in the DOM. */
  keepMounted?: boolean;
  attrs?: Record<string, string>;
};

const rootVariants = cva('', {
  variants: {
    variant: {
      list: '',
      boxed: 'flex flex-col gap-4',
      plain: '',
    },
  },
});

const itemVariants = cva('', {
  variants: {
    variant: {
      list: 'border-line border-b',
      boxed: 'border-line overflow-hidden rounded-md border',
      plain: '',
    },
  },
});

const headerRowVariants = cva('flex items-center', {
  variants: {
    variant: {
      list: '',
      boxed: 'px-4 transition-colors [&:not(:has(>h3>[data-disabled])):hover]:bg-surface-hover',
      plain: '',
    },
  },
});

// A static row has no button, so no hover fill and no hover text change.
const staticHeaderRowVariants = cva('flex items-center', {
  variants: {
    variant: {
      list: '',
      boxed: 'px-4',
      plain: '',
    },
  },
});

const staticRowVariants = cva('flex w-full items-center gap-2 text-left font-medium', {
  variants: {
    size: {
      default: 'py-3 text-sm',
      sm: 'py-2 text-xs',
    },
    tone: {
      default: 'text-fg',
      accent: 'text-accent',
    },
  },
});

const chevronSpacerVariants = cva('shrink-0', {
  variants: {
    size: {
      default: 'size-4',
      sm: 'size-3',
    },
  },
});

const triggerVariants = cva(
  cn(
    'group flex w-full items-center gap-2 text-left font-medium transition-colors',
    'rounded-sm',
    focusRingQuiet,
    'focus-visible:-outline-offset-2',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  ),
  {
    variants: {
      size: {
        default: 'py-3 text-sm',
        sm: 'py-2 text-xs',
      },
      tone: {
        default: 'text-fg hover:text-fg-default',
        accent: 'text-accent hover:text-accent-muted',
      },
    },
  },
);

const chevronVariants = cva('shrink-0 transition-transform duration-200', {
  variants: {
    size: {
      default: 'size-4',
      sm: 'size-3',
    },
    tone: {
      default: 'text-fg-subtle',
      accent: 'text-accent',
    },
    chevron: {
      end: 'ml-auto group-data-[panel-open]:rotate-180',
      start: '-rotate-90 group-data-[panel-open]:rotate-0',
      none: 'hidden',
    },
  },
});

// Base UI measures the panel into a variable, which is what lets the height animate.
const panelVariants = cva(
  'h-[var(--accordion-panel-height)] overflow-hidden text-sm transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0',
);

const panelInnerVariants = cva('', {
  variants: {
    variant: {
      list: '',
      // The header's hover fill ends at the panel, so the content needs room below it.
      boxed: 'px-4 pt-3',
      plain: '',
    },
    size: {
      default: 'pb-4',
      sm: 'pb-2',
    },
  },
});

export function Accordion({
  items,
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  variant = 'list',
  size = 'default',
  chevron = 'end',
  tone = 'default',
  keepMounted,
  attrs,
}: AccordionProps) {
  const chevronIcon = <ChevronDown className={chevronVariants({ size, tone, chevron })} />;
  return (
    <BaseAccordion.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={next => onValueChange?.(next.map(String))}
      multiple={multiple}
      keepMounted={keepMounted}
      className={rootVariants({ variant })}
      {...attrs}
    >
      {items.map(item =>
        item.content == null ? (
          // Outside BaseAccordion.Item: an Item expects a trigger and a panel to wire together.
          <div key={item.value} className={itemVariants({ variant })} {...item.attrs}>
            <div className={staticHeaderRowVariants({ variant })}>
              <h3 className="flex min-w-0 grow" {...item.triggerAttrs}>
                <span className={staticRowVariants({ size, tone })}>
                  {/* Holds the chevron's place, so labels and trailing line up with open-able rows. */}
                  {chevron === 'start' ? (
                    <span aria-hidden className={chevronSpacerVariants({ size })} />
                  ) : null}
                  <span className="min-w-0 grow">{item.label}</span>
                  {item.trailing != null ? (
                    <span className="ml-auto shrink-0">{item.trailing}</span>
                  ) : null}
                  {chevron === 'end' ? (
                    <span aria-hidden className={chevronSpacerVariants({ size })} />
                  ) : null}
                </span>
              </h3>
              {item.action != null ? <div className="shrink-0 pl-2">{item.action}</div> : null}
            </div>
          </div>
        ) : (
          <BaseAccordion.Item
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={itemVariants({ variant })}
            {...item.attrs}
          >
            <div className={headerRowVariants({ variant })}>
              <BaseAccordion.Header className="flex min-w-0 grow">
                <BaseAccordion.Trigger
                  className={triggerVariants({ size, tone })}
                  {...item.triggerAttrs}
                >
                  {chevron === 'start' ? chevronIcon : null}
                  <span className="min-w-0 grow">{item.label}</span>
                  {item.trailing != null ? (
                    <span className="ml-auto shrink-0">{item.trailing}</span>
                  ) : null}
                  {chevron === 'end' ? chevronIcon : null}
                </BaseAccordion.Trigger>
              </BaseAccordion.Header>
              {item.action != null ? <div className="shrink-0 pl-2">{item.action}</div> : null}
            </div>
            <BaseAccordion.Panel className={panelVariants()}>
              <div className={panelInnerVariants({ variant, size })}>{item.content}</div>
            </BaseAccordion.Panel>
          </BaseAccordion.Item>
        ),
      )}
    </BaseAccordion.Root>
  );
}
