import { type ReactElement, type ReactNode } from 'react';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import * as styles from './card.css';

export const cardVariants = lenient(styles.cardVariants);

const cardBodyVariants = lenient(styles.cardBodyVariants);

const cardTitleVariants = lenient(styles.cardTitleVariants);

type CardProps = {
  title?: string;
  description?: ReactElement | string;
  children?: ReactNode;
  variants?: NonNullable<Parameters<typeof cardVariants>[0]> &
    NonNullable<Parameters<typeof cardTitleVariants>[0]> &
    NonNullable<Parameters<typeof cardBodyVariants>[0]>;
};

export function Card({ children, title, description, variants }: CardProps) {
  const hasHeader = !!(title || description);

  return (
    <div className={cardVariants({ ...variants })}>
      {hasHeader ? (
        <div className={styles.cardDiv}>
          {title ? <h3 className={cardTitleVariants({ ...variants })}>{title}</h3> : null}
          {description ? <p className={styles.cardP}>{description}</p> : null}
        </div>
      ) : null}
      {children ? (
        <div className={cn(cardBodyVariants({ ...variants }), hasHeader && styles.cardDiv2)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
