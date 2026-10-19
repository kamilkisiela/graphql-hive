import { Check, Minus } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import * as styles from './checkbox.css';

const checkboxVariants = lenient(styles.checkboxVariants);

const iconSizeMap = {
  sm: 'size-2.5',
  md: 'size-3',
} as const;

export function Checkbox({
  size = 'md',
  variant,
  visual,
  ...props
}: Omit<BaseCheckbox.Root.Props, 'children' | 'className'> &
  NonNullable<Parameters<typeof checkboxVariants>[0]> & {
    /** When true, the checkbox is a non-interactive visual indicator (preserves hover styles, sets tabIndex: -1, aria-hidden) */
    visual?: boolean;
  }) {
  const iconClass = iconSizeMap[size ?? 'md'];
  return (
    <BaseCheckbox.Root
      className={checkboxVariants({ size, variant })}
      {...(visual
        ? {
            tabIndex: -1,
            'aria-hidden': true,
            style: { cursor: 'default' as const },
            onCheckedChange: undefined,
          }
        : {})}
      {...props}
    >
      <BaseCheckbox.Indicator className={styles.checkboxIndicator}>
        {props.indeterminate ? (
          <Minus className={iconClass} strokeWidth={3} />
        ) : (
          <Check className={iconClass} strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
