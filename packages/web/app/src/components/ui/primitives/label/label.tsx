import { type ReactNode } from 'react';
import { Info, type LucideIcon } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { Tooltip } from '../floating/tooltip/tooltip';
import * as styles from './label.css';

const labelVariants = lenient(styles.labelVariants);

export type LabelHintProps = {
  /** What the control is for, behind an icon beside the label. */
  tooltip?: ReactNode;
  /** The icon that carries the tooltip. Info unless the control warrants another. */
  icon?: LucideIcon;
};

type LabelProps = NonNullable<Parameters<typeof labelVariants>[0]> &
  LabelHintProps & {
    /** The id of the control this names. */
    htmlFor: string;
    /** Text only: a label names a control, anything more belongs in the tooltip. */
    label: string;
  };

/** The tooltip trigger beside a label. A button cannot sit inside a label, so it is a sibling. */
export function LabelHint({ tooltip, icon: Icon = Info, name }: LabelHintProps & { name: string }) {
  if (!tooltip) {
    return null;
  }
  return (
    <Tooltip
      trigger={
        <button type="button" aria-label={`About ${name}`} className={styles.labelHintButton}>
          <Icon className={styles.labelHintIcon} />
        </button>
      }
      content={tooltip}
    />
  );
}

/** A label for a control. On its own outside a form; inside one, FormLabel supplies `htmlFor`. */
export function Label({ htmlFor, variant, tooltip, icon, label }: LabelProps) {
  const element = (
    <label htmlFor={htmlFor} className={labelVariants({ variant })}>
      {label}
    </label>
  );
  if (!tooltip) {
    return element;
  }
  return (
    <span className={variant === 'inline' ? styles.labelSpan : styles.labelSpan2} data-label>
      {element}
      <LabelHint tooltip={tooltip} icon={icon} name={label} />
    </span>
  );
}

export { labelVariants };
