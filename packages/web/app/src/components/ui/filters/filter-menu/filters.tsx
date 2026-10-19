import { type ReactNode } from 'react';
import type { MenuSection } from '../../primitives/floating/menu/menu';
import { FilterChips, FilterMenu } from './filter-menu';
import type { FilterDimension } from './types';
import * as styles from './filters.css';

/**
 * Single composition for filter UIs across surfaces. Renders, in order:
 *   1. `FilterMenu` (the trigger that opens dimensions + any `extraSections`
 *      like saved-filter sub-menus). Trigger morphs to `activeLabel` + X
 *      when `activeLabel`/`onClearActive` are provided.
 *   2. `pinnedControls` — always-on controls (date range, view-range Select).
 *      These don't shift when chips appear.
 *   3. `FilterChips` — one chip per active dimension.
 *   4. `afterChips` — trailing controls (e.g. SaveFilterButton).
 */
export function Filters({
  dimensions,
  extraSections,
  pinnedControls,
  afterChips,
  activeLabel,
  onClearActive,
}: {
  dimensions: FilterDimension[];
  /** Forwarded to FilterMenu — e.g. saved-filter sub-menus + manage link. */
  extraSections?: MenuSection[];
  /** Always-rendered controls between the trigger and the chips. */
  pinnedControls?: ReactNode;
  /** Rendered after the chips. */
  afterChips?: ReactNode;
  /**
   * Active-state label for the menu trigger (e.g. an active saved-view name).
   * Matched pair with `onClearActive` — the trigger only morphs when both
   * are present.
   */
  activeLabel?: string;
  /** Handler for the trigger's clear-X icon. Matched pair with `activeLabel`. */
  onClearActive?: () => void;
}) {
  // A menu with nothing in it opens as an empty panel, so the row starts at the pinned controls
  // instead. An active view keeps the trigger because its clear button lives there.
  const hasMenu =
    dimensions.length > 0 || !!extraSections?.length || !!(activeLabel && onClearActive);

  return (
    <div className={styles.filtersDiv}>
      {hasMenu && (
        <FilterMenu
          dimensions={dimensions}
          extraSections={extraSections}
          activeLabel={activeLabel}
          onClearActive={onClearActive}
        />
      )}
      {pinnedControls}
      <FilterChips dimensions={dimensions} />
      {afterChips}
    </div>
  );
}
