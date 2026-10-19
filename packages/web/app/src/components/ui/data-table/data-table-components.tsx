import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnSurface } from '../primitives/shared-styles';
import * as styles from './data-table-components.css';

export type DataTableAlign = 'left' | 'center' | 'right';
export type DataTableWidth = 'xs' | 'sm' | 'md' | 'lg' | 'fill';
export type DataTableHideBelow = 'sm' | 'md';

/** Column layout, set once per column and applied to its header and every cell. */
export type DataTableColumnLayout = {
  align?: DataTableAlign;
  width?: DataTableWidth;
  hideBelow?: DataTableHideBelow;
};

const alignClass: Record<DataTableAlign, string> = {
  left: styles.alignClassLeft,
  center: styles.alignClassCenter,
  right: styles.alignClassRight,
};

const widthClass: Record<DataTableWidth, string> = {
  xs: styles.widthClassXs,
  sm: styles.widthClassSm,
  md: styles.widthClassMd,
  lg: styles.widthClassLg,
  // max-w-0 lets the fill column absorb the leftover width instead of widening the table to
  // fit its content, which is what allows a truncated cell to truncate at all.
  fill: styles.widthClassFill,
};

const hideBelowClass: Record<DataTableHideBelow, string> = {
  sm: styles.hideBelowClassSm,
  md: styles.hideBelowClassMd,
};

function layoutClass(layout: DataTableColumnLayout | undefined) {
  if (!layout) return '';
  return cn(
    layout.align && alignClass[layout.align],
    layout.width && widthClass[layout.width],
    layout.hideBelow && hideBelowClass[layout.hideBelow],
  );
}

// The surface ladder for the table's own chrome. The wrapper sits one step off the page and the
// header one more; a raised table (in a sheet, dialog or raised card) starts one step higher.
const surface = {
  base: {
    wrapper: 'bg-neutral-1 dark:bg-neutral-2',
    head: 'bg-surface-card',
    stripe: 'bg-neutral-2/60 dark:bg-neutral-3/60',
    hover: 'hover:bg-neutral-3 dark:hover:bg-neutral-4',
  },
  raised: {
    wrapper: 'bg-surface-card',
    head: 'bg-neutral-3 dark:bg-neutral-4',
    stripe: 'bg-neutral-3/60 dark:bg-neutral-4/60',
    hover: 'hover:bg-neutral-4 dark:hover:bg-neutral-5',
  },
} as const satisfies Record<OnSurface, Record<string, string>>;

export type DataTableTone = 'default' | 'critical' | 'warning';

const toned = {
  critical: {
    wrapper: 'border-critical-line bg-critical-tint-subtle',
    head: 'bg-critical-tint',
    stripe: 'bg-critical-tint/40',
    hover: 'hover:bg-critical-tint',
    line: 'border-critical-line-subtle',
    titleLine: 'border-critical-line',
    icon: 'text-critical',
  },
  warning: {
    wrapper: 'border-warning-line bg-warning-tint-subtle',
    head: 'bg-warning-tint',
    stripe: 'bg-warning-tint/40',
    hover: 'hover:bg-warning-tint',
    line: 'border-warning-line-subtle',
    titleLine: 'border-warning-line',
    icon: 'text-warning',
  },
} as const satisfies Record<Exclude<DataTableTone, 'default'>, Record<string, string>>;

// A borderless table sits on whatever holds it, a popover or a panel, so it brings no fill.
export function wrapperClass(
  onSurface: OnSurface,
  bordered: boolean,
  tone: DataTableTone = 'default',
) {
  return cn(
    styles.wrapperClassClass,
    bordered &&
      (tone === 'default'
        ? cn(styles.wrapperClassClass2, surface[onSurface].wrapper)
        : cn(styles.wrapperClassClass3, toned[tone].wrapper)),
  );
}

export function DataTableTitleBar({
  label,
  icon: Icon,
  aside,
  tone = 'default',
}: {
  label: React.ReactNode;
  icon?: LucideIcon;
  aside?: React.ReactNode;
  tone?: DataTableTone;
}) {
  return (
    <div
      className={cn(
        styles.dataTableTitleBarDiv,
        tone === 'default' ? styles.dataTableTitleBarDiv2 : toned[tone].titleLine,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            styles.dataTableTitleBarIcon,
            tone === 'default' ? styles.dataTableTitleBarIcon2 : toned[tone].icon,
          )}
        />
      ) : null}
      <span className={styles.dataTableTitleBarSpan}>{label}</span>
      {/* Held to the title's line height so a compact button does not make the bar taller. */}
      {aside ? <span className={styles.dataTableTitleBarSpan2}>{aside}</span> : null}
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return <thead className={styles.dataTableHeaderThead}>{children}</thead>;
}

export function DataTableBody({
  children,
  refreshing = false,
}: {
  children: React.ReactNode;
  /** The rows are the last settled ones while their replacement loads. */
  refreshing?: boolean;
}) {
  return (
    <tbody className={cn(styles.dataTableBodyTbody, refreshing && styles.dataTableBodyTbody2)}>
      {children}
    </tbody>
  );
}

export function DataTableRow({
  children,
  onClick,
  onSurface = 'base',
  striped = false,
  expanded = false,
  selected = false,
  muted = false,
  disabled = false,
  critical = false,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onSurface?: OnSurface;
  tone?: DataTableTone;
  /** This row takes the stripe tint. The table decides which rows, counting data rows only. */
  striped?: boolean;
  expanded?: boolean;
  /** The row the page is showing details for; brighter than hover so it survives the pointer leaving. */
  selected?: boolean;
  /** A row that is over, such as a solved ticket: text drops to fg-secondary. */
  muted?: boolean;
  /** A row that no longer applies, such as a disabled contract: faded, still readable. */
  disabled?: boolean;
  /** A row that needs attention, such as a disabled member: a critical tint over the stripe. */
  critical?: boolean;
}) {
  return (
    <tr
      data-state={expanded ? 'expanded' : selected ? 'selected' : undefined}
      onClick={onClick}
      className={cn(
        styles.dataTableRowTr,
        tone === 'default' ? styles.dataTableRowTr2 : toned[tone].line,
        // Hover means "this row does something": only a clickable or expandable row gets it.
        onClick && (tone === 'default' ? surface[onSurface].hover : toned[tone].hover),
        // The critical tint replaces the stripe rather than layering on it.
        striped &&
          !critical &&
          (tone === 'default' ? surface[onSurface].stripe : toned[tone].stripe),
        critical && styles.dataTableRowTr3,
        styles.dataTableRowTr4,
        styles.dataTableRowTr5,
        onClick && styles.dataTableRowTr6,
        muted && styles.dataTableRowTr7,
        disabled && styles.dataTableRowTr8,
      )}
    >
      {children}
    </tr>
  );
}

export function DataTableHead({
  children,
  compact,
  layout,
  onSurface = 'base',
  tone = 'default',
}: {
  children?: React.ReactNode;
  compact?: boolean;
  layout?: DataTableColumnLayout;
  onSurface?: OnSurface;
  tone?: DataTableTone;
}) {
  const head = tone === 'default' ? surface[onSurface].head : toned[tone].head;
  if (compact) {
    return <th className={cn(styles.dataTableHeadTh, head)} aria-hidden />;
  }
  return <th className={cn(styles.dataTableHeadTh2, head, layoutClass(layout))}>{children}</th>;
}

export function DataTableCellSlot({
  children,
  colSpan,
  variant,
  layout,
}: {
  children?: React.ReactNode;
  colSpan?: number;
  variant?: 'compact' | 'empty' | 'panel';
  layout?: DataTableColumnLayout;
}) {
  const className =
    variant === 'compact'
      ? styles.className
      : variant === 'empty'
        ? styles.className2
        : variant === 'panel'
          ? styles.className3
          : // Cells keep their content on one line; a `fill` column absorbs the width and a cell
            // that opts into `truncate` gives way, so a short value never breaks mid-phrase.
            cn(styles.dataTableCellSlotClass, layoutClass(layout));
  return (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  );
}

export function DataTableExpandedRow({
  colSpan,
  children,
  tone = 'default',
}: {
  colSpan: number;
  children: React.ReactNode;
  tone?: DataTableTone;
}) {
  return (
    <tr
      className={cn(
        styles.dataTableExpandedRowTr,
        tone === 'default'
          ? styles.dataTableExpandedRowTr2
          : cn(toned[tone].line, toned[tone].head),
      )}
    >
      <DataTableCellSlot colSpan={colSpan} variant="panel">
        {children}
      </DataTableCellSlot>
    </tr>
  );
}

export function DataTableFooterRow({
  label,
  value,
  columnCount,
  tone = 'default',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  columnCount: number;
  tone?: DataTableTone;
}) {
  return (
    <tfoot>
      <tr
        className={cn(
          styles.dataTableFooterRowTr,
          tone === 'default' ? styles.dataTableFooterRowTr2 : toned[tone].titleLine,
        )}
      >
        <td colSpan={Math.max(1, columnCount - 1)} className={styles.dataTableFooterRowTd}>
          {label}
        </td>
        <td className={styles.dataTableFooterRowTd2}>{value}</td>
      </tr>
    </tfoot>
  );
}
