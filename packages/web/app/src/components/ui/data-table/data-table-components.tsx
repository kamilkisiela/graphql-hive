import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnSurface } from '../primitives/shared-styles';

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
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const widthClass: Record<DataTableWidth, string> = {
  xs: 'w-16',
  sm: 'w-32',
  md: 'w-48',
  lg: 'w-64',
  // max-w-0 lets the fill column absorb the leftover width instead of widening the table to
  // fit its content, which is what allows a truncated cell to truncate at all.
  fill: 'w-full max-w-0 overflow-hidden',
};

const hideBelowClass: Record<DataTableHideBelow, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
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
    'overflow-hidden rounded-md',
    bordered &&
      (tone === 'default'
        ? cn('border-line border', surface[onSurface].wrapper)
        : cn('border', toned[tone].wrapper)),
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
        'flex items-center gap-2 border-b px-4 py-2.5',
        tone === 'default' ? 'border-line' : toned[tone].titleLine,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            'size-4 shrink-0',
            tone === 'default' ? 'text-fg-secondary' : toned[tone].icon,
          )}
        />
      ) : null}
      <span className="text-sm font-medium text-fg">{label}</span>
      {/* Held to the title's line height so a compact button does not make the bar taller. */}
      {aside ? (
        <span className="ml-auto flex h-5 items-center text-xs text-fg-secondary">{aside}</span>
      ) : null}
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="[&_tr:hover]:bg-transparent">{children}</thead>;
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
    <tbody
      className={cn(
        'transition-opacity [&>tr:last-child]:border-0',
        refreshing && 'pointer-events-none opacity-50',
      )}
    >
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
        'border-b transition-colors',
        tone === 'default' ? 'border-line' : toned[tone].line,
        // Hover means "this row does something": only a clickable or expandable row gets it.
        onClick && (tone === 'default' ? surface[onSurface].hover : toned[tone].hover),
        // The critical tint replaces the stripe rather than layering on it.
        striped &&
          !critical &&
          (tone === 'default' ? surface[onSurface].stripe : toned[tone].stripe),
        critical && 'bg-critical-tint-subtle',
        'data-[state=expanded]:border-b-0 data-[state=expanded]:bg-neutral-3',
        'data-[state=selected]:bg-neutral-12/10 dark:data-[state=selected]:bg-neutral-12/10',
        onClick && 'cursor-pointer',
        muted && 'text-fg-secondary',
        disabled && 'opacity-40',
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
    return <th className={cn('h-10 w-10', head)} aria-hidden />;
  }
  return (
    <th
      className={cn(
        'h-10 px-4 text-left align-middle text-xs font-normal whitespace-nowrap text-fg-secondary',
        head,
        layoutClass(layout),
      )}
    >
      {children}
    </th>
  );
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
      ? 'text-fg-secondary h-12 w-10 px-2 align-middle'
      : variant === 'empty'
        ? 'text-fg-secondary h-24 text-center align-middle'
        : variant === 'panel'
          ? 'p-0 align-middle'
          : // Cells keep their content on one line; a `fill` column absorbs the width and a cell
            // that opts into `truncate` gives way, so a short value never breaks mid-phrase.
            cn('h-12 whitespace-nowrap px-4 align-middle', layoutClass(layout));
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
        'border-b',
        tone === 'default' ? 'border-line bg-neutral-3' : cn(toned[tone].line, toned[tone].head),
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
      <tr className={cn('border-t', tone === 'default' ? 'border-line' : toned[tone].titleLine)}>
        <td
          colSpan={Math.max(1, columnCount - 1)}
          className="h-12 px-4 align-middle font-medium text-fg"
        >
          {label}
        </td>
        <td className="h-12 px-4 text-right align-middle font-medium text-fg">{value}</td>
      </tr>
    </tfoot>
  );
}
