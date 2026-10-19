import type { LucideIcon } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import * as styles from './badge.css';

const badgeVariants = lenient(styles.badgeVariants);

type BadgeProps = {
  content: string;
  /** Leads the text, in the text's colour. */
  icon?: LucideIcon;
  variants?: NonNullable<Parameters<typeof badgeVariants>[0]>;
};

export function Badge({ content, icon: Icon, variants }: BadgeProps) {
  return (
    <span className={badgeVariants({ ...variants })}>
      {Icon ? (
        <Icon
          aria-hidden
          className={variants?.size === 'sm' ? styles.badgeIcon : styles.badgeIcon2}
        />
      ) : null}
      {content}
    </span>
  );
}
