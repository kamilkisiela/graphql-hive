import { type ReactNode } from 'react';
import { lenient } from '@/lib/recipe';
import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import * as styles from './radio-group.css';

const radioItemVariants = lenient(styles.radioItemVariants);

const radioGroupVariants = lenient(styles.radioGroupVariants);

type RadioVariants = NonNullable<Parameters<typeof radioItemVariants>[0]>;

export type RadioItemProps = {
  value: string;
  /**
   * Accessible name for the option. Without it the name is read from the rendered content, which
   * for a card of body copy is the whole card. Worth setting whenever `content` is more than a
   * short label.
   */
  ariaLabel?: string;
} & (
  | {
      label: string;
      /** Supporting copy under the label. Rendered by `as-card` only. */
      description?: string;
      content?: never;
      withIndicator?: never;
    }
  | {
      /** Replaces the built-in label layout, and by default the radio dot with it. */
      content: ReactNode;
      /**
       * Keeps the radio dot in front of `content`. For options that supply their own body but
       * still need a visible control, rather than signalling selection by the card border alone.
       */
      withIndicator?: boolean;
      label?: never;
      description?: never;
    }
);

function RadioItem({
  item,
  variant,
  onSurface,
  orientation,
}: { item: RadioItemProps } & RadioVariants) {
  const isCard = variant === 'as-card';

  const indicator = isCard ? (
    <span className={styles.radioItemSpan}>
      <BaseRadio.Indicator className={styles.radioItemIndicator} />
    </span>
  ) : null;

  return (
    <BaseRadio.Root
      value={item.value}
      aria-label={item.ariaLabel}
      className={radioItemVariants({ variant, onSurface, orientation })}
    >
      {item.content ? (
        <>
          {item.withIndicator ? indicator : null}
          {item.content}
        </>
      ) : (
        <>
          {indicator}
          <span className={isCard ? styles.radioItemSpan2 : undefined}>
            <span className={isCard ? styles.radioItemSpan3 : undefined}>{item.label}</span>
            {isCard && item.description ? (
              <span className={styles.radioItemSpan4}>{item.description}</span>
            ) : null}
          </span>
        </>
      )}
    </BaseRadio.Root>
  );
}

type RadioGroupProps = {
  items: readonly RadioItemProps[];
  onValueChange: (value: string) => void;
  value: string;
  /** Makes every option in the group non-interactive. */
  disabled?: boolean;
} & RadioVariants;

export function RadioGroup({
  items,
  onValueChange,
  value,
  disabled,
  variant,
  onSurface,
  orientation,
}: RadioGroupProps) {
  const flow = orientation ?? (variant === 'as-card' ? 'vertical' : 'horizontal');

  return (
    <BaseRadioGroup
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-orientation={flow}
      className={radioGroupVariants({ orientation: flow, variant })}
    >
      {items.map(item => (
        <RadioItem
          key={item.value}
          item={item}
          variant={variant}
          onSurface={onSurface}
          orientation={flow}
        />
      ))}
    </BaseRadioGroup>
  );
}
