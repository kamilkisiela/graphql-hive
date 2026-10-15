import { cva, type VariantProps } from 'class-variance-authority';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyChip } from '../copy-chip/copy-chip';
import { Tooltip } from '../floating/tooltip/tooltip';

const termVariants = cva('text-fg-secondary mb-1 inline-flex items-center gap-1', {
  variants: {
    termStyle: {
      /** Small caps, for a details panel beside or under a table. */
      label: 'text-[9px] font-medium uppercase tracking-[0.75px]',
      /** Sentence case at 12px, for a card at the top of a page. */
      title: 'text-xs font-medium',
    },
  },
  defaultVariants: {
    termStyle: 'label',
  },
});

const rowVariants = cva('', {
  variants: {
    columns: {
      /** One column per item in the row. */
      fixed: 'grid gap-4',
      /** Each item as wide as its value, an even gap between, wrapping on a narrow window. */
      auto: 'flex flex-wrap gap-x-12 gap-y-3',
    },
  },
  defaultVariants: {
    columns: 'fixed',
  },
});

type DescriptionListVariants = VariantProps<typeof termVariants> & VariantProps<typeof rowVariants>;

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
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

function DescriptionListItem({
  term,
  description,
  tooltip,
  mono,
  copyable,
  attrs,
  termStyle,
}: DescriptionListItemProps & VariantProps<typeof termVariants>) {
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
              <span className="inline-flex text-fg-muted">
                <Info className="size-3" />
              </span>
            }
            content={tooltip}
          />
        ) : null}
      </div>
      {/* An identifier has no spaces to wrap at, so it breaks anywhere rather than overflowing. */}
      <div
        className={cn('text-control text-fg', mono && 'font-mono break-all')}
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
    <div className="space-y-3.5">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            rowVariants({ columns: variants?.columns }),
            variants?.columns !== 'auto' && (COLS_CLASS[row.items.length] ?? 'grid-cols-1'),
          )}
        >
          {row.items.map((item, itemIndex) => (
            <div
              key={itemIndex}
              // A long value (a commit, an email) truncates or wraps instead of pushing the row.
              className={cn('min-w-0', variants?.columns === 'auto' && 'max-w-80')}
            >
              <DescriptionListItem {...item} termStyle={variants?.termStyle} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
