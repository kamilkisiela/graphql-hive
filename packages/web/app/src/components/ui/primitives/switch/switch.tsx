import { lenient } from '@/lib/recipe';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import * as styles from './switch.css';

const switchRootVariants = lenient(styles.switchRootVariants);

const switchThumbVariants = lenient(styles.switchThumbVariants);

type SwitchProps = NonNullable<Parameters<typeof switchRootVariants>[0]> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** So a `<label htmlFor>` can point at it. */
  id?: string;
  /** For a switch with no visible label, such as one in a table row. */
  'aria-label'?: string;
  'data-cy'?: string;
  /**
   * Draws the switch as a read-out of state rather than as a control: not focusable, hidden from
   * assistive tech, and taking the cursor of whatever owns the click. Example: a switch inside a
   * menu row or a clickable card, where the row is the interactive thing and the switch only shows
   * whether it is on.
   */
  decorative?: boolean;
};

export function Switch({
  size,
  decorative,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  'data-cy': dataCy,
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      className={switchRootVariants({ size, decorative })}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      data-cy={dataCy}
      // A toggle's click never means "also activate whatever I am sitting in", so it is stopped
      // here rather than at each call site that puts a switch inside a clickable row.
      onClick={event => event.stopPropagation()}
    >
      <BaseSwitch.Thumb className={switchThumbVariants({ size })} />
    </BaseSwitch.Root>
  );
}
