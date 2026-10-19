import { type ComponentType, type ReactNode } from 'react';
import { lenient } from '@/lib/recipe';
import { Link, type LinkOptions } from '@tanstack/react-router';
import { Tooltip } from '../primitives/floating/tooltip/tooltip';
import * as styles from './navigation.css';

export type NavigationVariant = 'underline' | 'pill' | 'list';
export type NavigationSize = 'default' | 'sm';

type LinkAttributes = Pick<LinkOptions, 'to' | 'params' | 'search'>;

export type NavigationItem = LinkAttributes & {
  /** Also the item's key, so unique within one nav. */
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Explains the destination on hover: what a filter shows, say. */
  tooltip?: ReactNode;
  /** Hidden items are left out entirely, as a permission gate needs. */
  visible?: boolean;
  /**
   * For the item whose `to` is the parent path itself (Schema at the target root, General at
   * `/settings`): the router counts a link as current on a path prefix, which would make that item
   * current on every sibling page.
   */
  exact?: boolean;
  /**
   * For a search-driven default item whose `search` sets its key to `undefined` (the Details
   * section of a proposal): current only while the URL has no such key at all.
   */
  explicitUndefined?: boolean;
  /** Extra attributes for the anchor, `data-cy` for one. */
  attrs?: Record<string, string>;
};

type NavigationProps = {
  items: readonly NavigationItem[];
  variant?: NavigationVariant;
  size?: NavigationSize;
  /** Draws placeholders in place of the links while the page that owns them loads. */
  loading?: boolean;
  /** Sits at the bar's far edge: the target's "Connect to CDN", say. Bars only. */
  actions?: ReactNode;
  'aria-label'?: string;
  attrs?: Record<string, string>;
};

const listVariants = lenient(styles.listVariants);

const itemVariants = lenient(styles.itemVariants);

const activeClasses: Record<NavigationVariant, string> = {
  underline: styles.activeClassesUnderline,
  pill: styles.activeClassesPill,
  list: styles.activeClassesList,
};

const inactiveClasses: Record<NavigationVariant, string> = {
  underline: styles.inactiveClassesUnderline,
  pill: styles.inactiveClassesPill,
  list: styles.inactiveClassesList,
};

export function Navigation({
  items,
  variant = 'underline',
  size = 'default',
  loading = false,
  actions,
  'aria-label': ariaLabel = 'Secondary',
  attrs,
}: NavigationProps) {
  const links = loading ? (
    <div className={variant === 'list' ? styles.navigationDiv : styles.navigationDiv2}>
      {[0, 1, 2].map(index => (
        <div key={index} className={styles.navigationDiv3} />
      ))}
    </div>
  ) : (
    <nav aria-label={ariaLabel}>
      <ul className={listVariants({ variant })}>
        {items
          .filter(item => item.visible !== false)
          .map(
            ({
              label,
              icon: Icon,
              tooltip,
              visible: _visible,
              exact,
              explicitUndefined,
              attrs: itemAttrs,
              ...link
            }) => {
              const anchor = (
                <Link
                  {...link}
                  activeOptions={{
                    exact: exact === true,
                    // A link without `search` stays current whatever the URL's search holds.
                    includeSearch: link.search !== undefined,
                    explicitUndefined: explicitUndefined === true,
                  }}
                  className={itemVariants({ variant, size })}
                  activeProps={{ className: activeClasses[variant] }}
                  inactiveProps={{ className: inactiveClasses[variant] }}
                  {...itemAttrs}
                >
                  {Icon ? <Icon className={styles.navigationIcon} /> : null}
                  {label}
                </Link>
              );
              return (
                <li key={label} className={styles.navigationLi}>
                  {tooltip == null ? (
                    anchor
                  ) : (
                    <Tooltip
                      trigger={<span className={styles.navigationSpan}>{anchor}</span>}
                      content={tooltip}
                    />
                  )}
                </li>
              );
            },
          )}
      </ul>
    </nav>
  );

  if (actions == null) {
    return <div {...attrs}>{links}</div>;
  }
  return (
    <div className={styles.navigationDiv4} {...attrs}>
      {links}
      {actions}
    </div>
  );
}
