import { Info } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import { CopyChip } from '../copy-chip/copy-chip';
import { Tooltip } from '../floating/tooltip/tooltip';
import * as styles from './description-list.css';

const termVariants = lenient(styles.termVariants);

const rowVariants = lenient(styles.rowVariants);

type DescriptionListVariants = NonNullable<Parameters<typeof termVariants>[0]> &
  NonNullable<Parameters<typeof rowVariants>[0]>;

type DescriptionListItemProps = {
  term: string;
  description: React.ReactNode;
  /** Explains the term, on an info icon after it. */
  tooltip?: string;
  /** An identifier, endpoint or record value rather than prose. */
  mono?: boolean;
  /** A string description the reader will paste somewhere: rendered as a copy chip. */
  copyable?: boolean;
  /** Attributes for the value element, such as a hook for a test. */
  attrs?: Record<string, string>;
};

type DescriptionListItemRowProps = {
  items: Array<DescriptionListItemProps>;
};

type DescriptionListProps = {
  rows: Array<DescriptionListItemRowProps>;
  variants?: DescriptionListVariants;
};

// Tailwind needs full class strings to detect them — explicit map by column count.
const COLS_CLASS: Record<number, string> = {
  1: styles.colsClass1,
  2: styles.colsClass2,
  3: styles.colsClass3,
  4: styles.colsClass4,
  5: styles.colsClass5,
  6: styles.colsClass6,
};

function DescriptionListItem({
  term,
  description,
  tooltip,
  mono,
  copyable,
  attrs,
  termStyle,
}: DescriptionListItemProps & NonNullable<Parameters<typeof termVariants>[0]>) {
  const value =
    copyable && typeof description === 'string' ? (
      <CopyChip value={description} attrs={attrs} />
    ) : attrs ? (
      <span {...attrs}>{description}</span>
    ) : (
      description
    );
  return (
    <>
      <div className={termVariants({ termStyle })}>
        {term}
        {tooltip ? (
          <Tooltip
            trigger={
              <span className={styles.descriptionListItemSpan}>
                <Info className={styles.descriptionListItemInfo} />
              </span>
            }
            content={tooltip}
          />
        ) : null}
      </div>
      {/* An identifier has no spaces to wrap at, so it breaks anywhere rather than overflowing. */}
      <div
        className={cn(styles.descriptionListItemDiv, mono && styles.descriptionListItemDiv2)}
        // A value that gets clipped by a narrow column can still be read on hover.
        title={typeof description === 'string' ? description : undefined}
      >
        {value}
      </div>
    </>
  );
}

export function DescriptionList({ rows, variants }: DescriptionListProps) {
  return (
    <div className={styles.descriptionListDiv}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            rowVariants({ columns: variants?.columns }),
            variants?.columns !== 'auto' &&
              (COLS_CLASS[row.items.length] ?? styles.descriptionListDiv2),
          )}
        >
          {row.items.map((item, itemIndex) => (
            <div
              key={itemIndex}
              // A long value (a commit, an email) truncates or wraps instead of pushing the row.
              className={cn(
                styles.descriptionListDiv3,
                variants?.columns === 'auto' && styles.descriptionListDiv4,
              )}
            >
              <DescriptionListItem {...item} termStyle={variants?.termStyle} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
