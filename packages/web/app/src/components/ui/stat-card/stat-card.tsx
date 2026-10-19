import { type ComponentType, type ReactNode } from 'react';
import { InfoIcon } from 'lucide-react';
import { Card } from '@/components/ui/primitives/card/card';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { lenient } from '@/lib/recipe';
import * as styles from './stat-card.css';

const statTitleVariants = lenient(styles.statTitleVariants);

type StatCardProps = {
  title: string;
  /** A node rather than a string, so a call site can suffix the figure (`1,204,880 (3,120 errors)`). */
  value: ReactNode;
  caption?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Renders an info icon after the title, explaining how the metric is derived. */
  hint?: ReactNode;
  variants?: NonNullable<Parameters<typeof statTitleVariants>[0]>;
};

export function StatCard({ title, value, caption, icon: Icon, hint, variants }: StatCardProps) {
  return (
    <Card variants={{ onSurface: 'raised' }}>
      <div className={styles.statCardDiv}>
        <div className={styles.statCardDiv2}>
          <h3 className={statTitleVariants({ ...variants })}>{title}</h3>
          {hint ? (
            <Tooltip
              trigger={
                <button type="button" aria-label="What this measures">
                  <InfoIcon className={styles.statCardInfoIcon} />
                </button>
              }
              content={hint}
            />
          ) : null}
        </div>
        {/* `shrink-0` so a title that wraps to two lines ("Relative Request Frequency") pushes the
            icon rather than squashing it. */}
        {Icon ? <Icon className={styles.statCardIcon} /> : null}
      </div>
      <div className={styles.statCardDiv3}>{value}</div>
      {caption ? <p className={styles.statCardP}>{caption}</p> : null}
    </Card>
  );
}
