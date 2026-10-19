import { type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { focusRingQuiet } from '../shared-styles';
import * as styles from './accordion.css';

export type AccordionItem = {
  value: string;
  /** Text, or a two-line header, badges, icons. */
  label: ReactNode;
  /** At the far end of the trigger, before the chevron: a count, a status. */
  trailing?: ReactNode;
  /** Beside the trigger, outside it: a menu button. A button cannot nest in a button. */
  action?: ReactNode;
  content: ReactNode;
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

const rootVariants = lenient(styles.rootVariants);

const itemVariants = lenient(styles.itemVariants);

const headerRowVariants = lenient(styles.headerRowVariants);

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

const chevronVariants = lenient(styles.chevronVariants);

// Base UI measures the panel into a variable, which is what lets the height animate.
const panelVariants = lenient(styles.panelVariants);

const panelInnerVariants = lenient(styles.panelInnerVariants);

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
      {items.map(item => (
        <BaseAccordion.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={itemVariants({ variant })}
          {...item.attrs}
        >
          <div className={headerRowVariants({ variant })}>
            <BaseAccordion.Header className={styles.accordionHeader}>
              <BaseAccordion.Trigger
                className={triggerVariants({ size, tone })}
                {...item.triggerAttrs}
              >
                {chevron === 'start' ? chevronIcon : null}
                <span className={styles.accordionSpan}>{item.label}</span>
                {item.trailing != null ? (
                  <span className={styles.accordionSpan2}>{item.trailing}</span>
                ) : null}
                {chevron === 'end' ? chevronIcon : null}
              </BaseAccordion.Trigger>
            </BaseAccordion.Header>
            {item.action != null ? <div className={styles.accordionDiv}>{item.action}</div> : null}
          </div>
          <BaseAccordion.Panel className={panelVariants()}>
            <div className={panelInnerVariants({ variant, size })}>{item.content}</div>
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
}
