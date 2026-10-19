import { lenient } from '@/lib/recipe';
import { Separator as BaseSeparator } from '@base-ui/react/separator';
import * as styles from './separator.css';

const separatorVariants = lenient(styles.separatorVariants);

type SeparatorProps = {
  orientation?: 'horizontal' | 'vertical';
  /** Vertical only: fill the row's height instead of a control's. */
  stretch?: boolean;
};

export function Separator({ orientation = 'horizontal', stretch = false }: SeparatorProps) {
  return (
    <BaseSeparator
      orientation={orientation}
      className={separatorVariants({ orientation, stretch })}
    />
  );
}
