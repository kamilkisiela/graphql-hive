import { lenient } from '@/lib/recipe';
import * as styles from './status-dot.css';

const statusDotVariants = lenient(styles.statusDotVariants);

type StatusDotProps = NonNullable<Parameters<typeof statusDotVariants>[0]> & {
  /**
   * What the colour means, for assistive tech. Leave it out when the text beside the dot already
   * says so, and the dot is decoration.
   */
  label?: string;
};

/** A coloured dot standing for a state: a check passed, a version is invalid, an alert is critical. */
export function StatusDot({ color, size, label }: StatusDotProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={statusDotVariants({ color, size })}
    />
  );
}
