import type { MouseEvent, ReactNode } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Info,
  MoreHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toDecimal } from '@/lib/hooks/use-decimal';
import { formatNumber as formatCompact } from '@/lib/hooks/use-formatted-number';
import { cn } from '@/lib/utils';
import { Link, useNavigate, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router';
import { Avatar } from '../primitives/avatar/avatar';
import { Badge } from '../primitives/badge/badge';
import { Button } from '../primitives/button/button';
import { Checkbox } from '../primitives/checkbox/checkbox';
import { CopyChip } from '../primitives/copy-chip/copy-chip';
import { Menu } from '../primitives/floating/menu/menu';
import { Tooltip } from '../primitives/floating/tooltip/tooltip';
import { StatusDot } from '../primitives/status-dot/status-dot';
import * as styles from './data-table-cell.css';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'critical'
  | 'info';
type StatusColor = 'success' | 'warning' | 'critical' | 'info' | 'neutral';

type BadgeItem = { content: string; variant?: BadgeVariant };
type MenuSections = NonNullable<React.ComponentProps<typeof Menu>['sections']>;

/** A route through the router: `to`, `params`, `search` and `hash` as TanStack's Link takes them. */
export type DataTableRoute<TTo extends string> = LinkOptions<RegisteredRouter, '/', TTo>;

/** Where a cell sends the reader: a route, or a plain href for anything outside the router. */
export type DataTableDestination<TTo extends string> =
  | { link: DataTableRoute<TTo>; href?: never; external?: never }
  | { href: string; external?: boolean; link?: never };

/** One destination a cell can send the reader to. */
export type DataTableLinkTarget<TTo extends string> = { label: string } & DataTableDestination<TTo>;

export type DataTableCellProps<TTo extends string = '.'> =
  | {
      kind: 'text';
      value: ReactNode;
      weight?: 'regular' | 'medium';
      tone?: 'default' | 'muted';
      mono?: boolean;
      /** Cut the value at the column width with an ellipsis. */
      truncate?: boolean;
      /** A muted aside after the value, such as "(unlimited seats)". */
      secondary?: ReactNode;
      /** Something after the value that qualifies it: a badge, an icon with a tooltip. */
      trailing?: ReactNode;
    }
  | {
      kind: 'number';
      value: number | string;
      /**
       * How a number is written; a string is shown as given. `compact` abbreviates a large count
       * ("1.2M") for a column scanned for magnitude; `percent` always carries two decimals.
       */
      format?: 'count' | 'compact' | 'percent' | 'currency';
    }
  | {
      kind: 'time';
      date: string | number | Date;
      /**
       * `relative-info` is the relative time with the absolute one behind an info icon; `date`
       * is the day alone, for an invoice or a period where the time of day says nothing.
       */
      mode?: 'relative' | 'absolute' | 'relative-info' | 'date';
      /**
       * Written before the time, for a headerless list where nothing else says what the time is:
       * "created 3w ago", "last used 1d ago". Under a header it only repeats the header.
       */
      prefix?: string;
      tone?: 'default' | 'muted';
      mono?: boolean;
    }
  | ({
      kind: 'link';
      label: ReactNode;
      tone?: 'default' | 'accent';
      mono?: boolean;
      /** Cut the label at the column width with an ellipsis; the full label sits in the title. */
      truncate?: boolean;
      /** Something after the link that qualifies it: a badge, an icon with a tooltip. */
      trailing?: ReactNode;
    } & DataTableDestination<TTo>)
  | {
      /**
       * A value that leads elsewhere without being the link itself: the label stays text and an
       * icon after it goes to the target. Several targets become a menu on a chevron trigger.
       */
      kind: 'link-out';
      label: ReactNode;
      targets: DataTableLinkTarget<TTo>[];
      /** Shown on the icon: "Open in Insights". */
      tooltip: string;
      mono?: boolean;
    }
  | {
      kind: 'badge';
      items: BadgeItem | BadgeItem[];
      /** How many badges show on the row; the rest collapse into a "+N" badge that lists them. */
      max?: number;
    }
  /** A yes or no as a check or a cross, for a flag column. */
  | { kind: 'boolean'; value: boolean }
  | { kind: 'status'; label: ReactNode; dot: StatusColor; tooltip?: string }
  | {
      kind: 'status';
      label: ReactNode;
      icon: LucideIcon;
      iconTone?: StatusColor;
      /** Explains the state, such as "The domain ownership challenge has not been completed." */
      tooltip?: string;
    }
  | { kind: 'status'; from: BadgeItem; to: BadgeItem }
  | {
      kind: 'avatar';
      name: string;
      src?: string | null;
      /** The person no longer counts here, such as a disabled member: the name is struck through. */
      strikethrough?: boolean;
      /** Something after the name that qualifies it: an icon with a tooltip, a badge. */
      trailing?: ReactNode;
    }
  | {
      kind: 'copy';
      value: string;
      /** What the chip shows when the value itself is too long for a cell, such as a short id. */
      label?: string;
    }
  | {
      kind: 'checkbox';
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
      /** Names the row for assistive tech: "Select Team Slack". */
      label: string;
    }
  | {
      kind: 'actions';
      /** Menu sections, as Menu takes them. */
      sections: MenuSections;
      label?: string;
    }
  | {
      kind: 'icon-button';
      icon: LucideIcon;
      label: string;
      onClick: () => void;
      destructive?: boolean;
    }
  | { kind: 'bar'; value: number; max: number }
  | { kind: 'placeholder' };

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/** "now", "5m ago", "3h ago", "12d ago", "2w ago", "4mo ago", "2y ago". */
export function formatRelative(date: Date, now = Date.now()): string {
  const d = (now - date.getTime()) / 1000;
  if (d < MINUTE * 2) return 'now';
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`;
  if (d < WEEK) return `${Math.floor(d / DAY)}d ago`;
  if (d < MONTH) return `${Math.floor(d / WEEK)}w ago`;
  if (d < YEAR) return `${Math.floor(d / MONTH)}mo ago`;
  return `${Math.floor(d / YEAR)}y ago`;
}

export function formatAbsolute(date: Date): string {
  return format(date, 'MMM d, yyyy HH:mm');
}

export function formatDay(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatCellNumber(
  value: number | string,
  kind: 'count' | 'compact' | 'percent' | 'currency' | undefined,
) {
  if (typeof value === 'string') return value;
  if (kind === 'currency') return currency.format(value);
  if (kind === 'percent') return `${toDecimal(value)}%`;
  if (kind === 'compact') return String(formatCompact(value));
  return value.toLocaleString('en-US');
}

/** Controls inside a clickable or expandable row act on their own: the click stops here. */
function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

const tone = { default: 'text-fg', muted: 'text-fg-secondary' } as const;
const linkTone = {
  default: 'text-fg-default hover:text-fg hover:underline underline-offset-2',
  accent: 'text-accent-muted hover:text-accent hover:underline underline-offset-2',
} as const;

const statusIconTone: Record<StatusColor, string> = {
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-critical',
  info: 'text-info',
  neutral: 'text-fg-secondary',
};

function Destination<TTo extends string>({
  destination,
  className,
  children,
  title,
  'aria-label': ariaLabel,
}: {
  destination: DataTableDestination<TTo>;
  className: string;
  children: ReactNode;
  title?: string;
  'aria-label'?: string;
}) {
  if (destination.link) {
    return (
      // TanStack resolves the route generics at the call site, where `DataTableRoute<TTo>` is
      // checked in full; inside the component TTo is opaque and no Link overload matches, the
      // same situation ui/link sits in. No preload: a pointer moving down a table would run a
      // route loader per row it crossed; the nav keeps preloading on intent.
      // @ts-expect-error see above
      <Link
        {...destination.link}
        preload={false}
        className={className}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={destination.href}
      target={destination.external ? '_blank' : undefined}
      rel={destination.external ? 'noreferrer' : undefined}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/** Its own component so the router hook only runs where several targets need a menu. */
function LinkOutMenu<TTo extends string>({
  targets,
  tooltip,
}: {
  targets: DataTableLinkTarget<TTo>[];
  tooltip: string;
}) {
  const navigate = useNavigate();
  return (
    <Menu
      align="start"
      width="sm"
      trigger={
        <button type="button" aria-label={tooltip} className={styles.linkOutMenuButton}>
          <ExternalLink className={styles.linkOutMenuExternalLink} />
          <ChevronDown className={styles.linkOutMenuChevronDown} />
        </button>
      }
      sections={[
        {
          label: tooltip,
          items: targets.map(target =>
            target.link
              ? {
                  label: target.label,
                  // Same opaque-generic situation as in Destination above.
                  // @ts-expect-error see Destination
                  onClick: () => void navigate(target.link),
                }
              : {
                  kind: 'link' as const,
                  label: target.label,
                  href: target.href,
                  external: target.external,
                },
          ),
        },
      ]}
    />
  );
}

/**
 * What a table cell holds, by kind. Column layout (alignment, width, responsive hiding) is the
 * column's, set in its `meta`; this is only the content.
 */
export function DataTableCell<TTo extends string = '.'>(props: DataTableCellProps<TTo>) {
  switch (props.kind) {
    case 'text': {
      const value = (
        <span
          className={cn(
            tone[props.tone ?? 'default'],
            props.weight === 'medium' && styles.dataTableCellSpan,
            props.mono && styles.dataTableCellSpan2,
            props.truncate && styles.dataTableCellSpan3,
          )}
          title={props.truncate && typeof props.value === 'string' ? props.value : undefined}
        >
          {props.value}
          {props.secondary != null ? (
            <span className={styles.dataTableCellSpan4}> {props.secondary}</span>
          ) : null}
        </span>
      );
      if (!props.trailing) return value;
      return (
        <span className={styles.dataTableCellSpan5}>
          {value}
          {props.trailing}
        </span>
      );
    }
    case 'number':
      return (
        <span className={styles.dataTableCellSpan6}>
          {formatCellNumber(props.value, props.format)}
        </span>
      );
    case 'time': {
      const date = new Date(props.date);
      const mode = props.mode ?? 'relative';
      const text =
        mode === 'absolute'
          ? formatAbsolute(date)
          : mode === 'date'
            ? formatDay(date)
            : formatRelative(date);
      return (
        <span
          className={cn(
            styles.dataTableCellSpan7,
            tone[props.tone ?? 'default'],
            props.mono && styles.dataTableCellSpan8,
          )}
        >
          {props.prefix ? <span className={styles.dataTableCellSpan9}>{props.prefix}</span> : null}
          <time
            dateTime={date.toISOString()}
            title={mode === 'absolute' ? undefined : formatAbsolute(date)}
          >
            {text}
          </time>
          {mode === 'relative-info' ? (
            <Tooltip
              trigger={
                <span className={styles.dataTableCellSpan10}>
                  <Info className={styles.dataTableCellInfo} />
                </span>
              }
              content={formatAbsolute(date)}
            />
          ) : null}
        </span>
      );
    }
    case 'link': {
      const link = (
        <Destination
          destination={props}
          className={cn(
            linkTone[props.tone ?? 'default'],
            props.mono && styles.dataTableCellDestination,
            props.truncate && styles.dataTableCellDestination2,
          )}
          title={props.truncate && typeof props.label === 'string' ? props.label : undefined}
        >
          {props.label}
        </Destination>
      );
      // `contents` keeps a truncating link laid out by the cell itself.
      return (
        <span
          className={props.trailing ? styles.dataTableCellSpan11 : styles.dataTableCellSpan12}
          onClick={stopPropagation}
        >
          {link}
          {props.trailing}
        </span>
      );
    }
    case 'link-out': {
      const label = (
        <span className={cn(styles.dataTableCellSpan13, props.mono && styles.dataTableCellSpan14)}>
          {props.label}
        </span>
      );
      if (props.targets.length === 0) return label;
      if (props.targets.length === 1) {
        return (
          <span className={styles.dataTableCellSpan15} onClick={stopPropagation}>
            {label}
            <Tooltip
              trigger={
                <Destination
                  destination={props.targets[0]}
                  aria-label={props.tooltip}
                  className={styles.dataTableCellDestination3}
                >
                  <ExternalLink className={styles.dataTableCellExternalLink} />
                </Destination>
              }
              content={props.tooltip}
            />
          </span>
        );
      }
      return (
        <span className={styles.dataTableCellSpan16} onClick={stopPropagation}>
          {label}
          <LinkOutMenu targets={props.targets} tooltip={props.tooltip} />
        </span>
      );
    }
    case 'badge': {
      const items = Array.isArray(props.items) ? props.items : [props.items];
      const shown = items.slice(0, props.max ?? 3);
      const rest = items.slice(shown.length);
      return (
        <span className={styles.dataTableCellSpan17}>
          {shown.map((item, index) => (
            <Badge key={index} content={item.content} variants={{ variant: item.variant }} />
          ))}
          {rest.length > 0 ? (
            <Tooltip
              trigger={
                <span className={styles.dataTableCellSpan18}>
                  <Badge content={`+${rest.length}`} variants={{ variant: 'outline' }} />
                </span>
              }
              content={rest.map(item => item.content).join(', ')}
            />
          ) : null}
        </span>
      );
    }
    case 'boolean':
      return props.value ? (
        <Check className={styles.dataTableCellCheck} aria-label="Yes" />
      ) : (
        <X className={styles.dataTableCellX} aria-label="No" />
      );
    case 'status': {
      if ('dot' in props) {
        const body = (
          <span className={styles.dataTableCellSpan19}>
            <StatusDot color={props.dot} />
            {props.label}
          </span>
        );
        return props.tooltip ? <Tooltip trigger={body} content={props.tooltip} /> : body;
      }
      if ('icon' in props) {
        const Icon = props.icon;
        const body = (
          <span className={styles.dataTableCellSpan20}>
            {props.label}
            <Icon
              className={cn(styles.dataTableCellIcon, statusIconTone[props.iconTone ?? 'neutral'])}
            />
          </span>
        );
        return props.tooltip ? <Tooltip trigger={body} content={props.tooltip} /> : body;
      }
      return (
        <span className={styles.dataTableCellSpan21}>
          <Badge content={props.from.content} variants={{ variant: props.from.variant }} />
          <ArrowRight className={styles.dataTableCellArrowRight} />
          <Badge content={props.to.content} variants={{ variant: props.to.variant }} />
        </span>
      );
    }
    case 'avatar':
      return (
        <span className={styles.dataTableCellSpan22}>
          <Avatar size="xs" alt={props.name} src={props.src} />
          <span className={cn(props.strikethrough && styles.dataTableCellSpan23)}>
            {props.name}
          </span>
          {props.trailing}
        </span>
      );
    case 'copy':
      return (
        <span className={styles.dataTableCellSpan24} onClick={stopPropagation}>
          <CopyChip value={props.value} label={props.label} />
        </span>
      );
    case 'checkbox':
      return (
        <span className={styles.dataTableCellSpan25} onClick={stopPropagation}>
          <Checkbox
            checked={props.checked}
            onCheckedChange={checked => props.onCheckedChange(checked === true)}
            aria-label={props.label}
          />
        </span>
      );
    case 'actions':
      return (
        <span className={styles.dataTableCellSpan26} onClick={stopPropagation}>
          <Menu
            align="end"
            width="sm"
            trigger={
              <Button
                layout="iconOnly"
                icon={MoreHorizontal}
                aria-label={props.label ?? 'Actions'}
                variant="ghost"
                size="compact"
              />
            }
            sections={props.sections}
          />
        </span>
      );
    case 'icon-button':
      return (
        <span className={styles.dataTableCellSpan27} onClick={stopPropagation}>
          <Tooltip
            trigger={
              <Button
                layout="iconOnly"
                icon={props.icon}
                aria-label={props.label}
                variant={props.destructive ? 'destructive' : 'ghost'}
                size="compact"
                onClick={props.onClick}
              />
            }
            content={props.label}
          />
        </span>
      );
    case 'bar': {
      const segments = 10;
      // Any share at all lights one segment, so a long tail of tiny values still reads as present.
      const filled =
        props.max > 0 && props.value > 0
          ? Math.max(1, Math.round((props.value / props.max) * segments))
          : 0;
      return (
        <span
          className={styles.dataTableCellSpan28}
          role="meter"
          aria-valuenow={props.value}
          aria-valuemin={0}
          aria-valuemax={props.max}
        >
          {Array.from({ length: segments }, (_, i) => (
            <span
              key={i}
              className={cn(
                styles.dataTableCellSpan29,
                i < filled ? styles.dataTableCellSpan30 : styles.dataTableCellSpan31,
              )}
            />
          ))}
        </span>
      );
    }
    case 'placeholder':
      return <span className={styles.dataTableCellSpan32}>—</span>;
  }
}
