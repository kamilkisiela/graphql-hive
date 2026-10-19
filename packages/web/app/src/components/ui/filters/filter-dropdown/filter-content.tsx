import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FloatingSearch } from '../../primitives/floating/floating-search';
import { floatingEmptyState, menuPanelInset } from '../../primitives/floating/shared-styles';
import { ItemRow, ListScrollContext } from './item-row';
import type { FilterItem, FilterSelection } from './types';
import * as styles from './filter-content.css';

const ITEM_HEIGHT = 28; // h-7
const MAX_LIST_HEIGHT = 256; // max-h-64
/** Hide the search input when the list is short enough to scan at a glance. */
export const SEARCH_VISIBILITY_THRESHOLD = 15;

function getKey(item: FilterItem | FilterSelection): string {
  return item.id ?? item.name;
}

function isItemSelected(item: FilterItem, selectedItems: FilterSelection[]): boolean {
  const key = getKey(item);
  return selectedItems.some(s => getKey(s) === key);
}

function getItemSelection(
  item: FilterItem,
  selectedItems: FilterSelection[],
): FilterSelection | null {
  const key = getKey(item);
  return selectedItems.find(s => getKey(s) === key) ?? null;
}

export type FilterContentProps = {
  /** Used in the search input's aria-label */
  label: string;
  /** Available items and their sub-values */
  items: FilterItem[];
  /** Currently selected items */
  selectedItems: FilterSelection[];
  /** Called when selection changes */
  onChange: (value: FilterSelection[]) => void;
  /** Label for the sub-values (e.g. "versions", "endpoints"). Used in accessibility labels. */
  valuesLabel?: string;
  /** When true, picking an item replaces the selection instead of adding to it. */
  singleSelect?: boolean;
  /** Show the search box regardless of how many items there are. */
  alwaysShowSearch?: boolean;
};

export function FilterContent({
  label,
  items,
  selectedItems,
  onChange,
  valuesLabel = 'values',
  singleSelect,
  alwaysShowSearch,
}: FilterContentProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Snapshot which items were selected when the dropdown opened.
  // This sort order is frozen — toggling items won't move them.
  // Resets naturally when the portal unmounts on close and remounts on reopen.
  const initialSelectedKeys = useRef<Set<string>>(null!);
  if (initialSelectedKeys.current === null) {
    initialSelectedKeys.current = new Set(selectedItems.map(getKey));
  }

  const filteredItems = useMemo(() => {
    const matched = items.filter(item =>
      item.name.toLowerCase().includes(deferredSearch.toLowerCase()),
    );
    return matched.sort((a, b) => {
      // Initially-selected items first
      const aSelected = initialSelectedKeys.current.has(getKey(a)) ? 0 : 1;
      const bSelected = initialSelectedKeys.current.has(getKey(b)) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      // Unavailable items to the bottom within each group
      return (a.unavailable ? 1 : 0) - (b.unavailable ? 1 : 0);
    });
  }, [items, deferredSearch]);

  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
    paddingStart: 8,
  });

  // Keep a ref to selectedItems so callbacks below stay stable across renders.
  const selectedItemsRef = useRef(selectedItems);
  selectedItemsRef.current = selectedItems;

  const toggleItem = useCallback(
    (item: FilterItem) => {
      const key = getKey(item);
      const current = selectedItemsRef.current;
      const next = { id: item.id, name: item.name, values: null };
      if (current.some(s => getKey(s) === key)) {
        onChange(singleSelect ? [] : current.filter(s => getKey(s) !== key));
      } else {
        onChange(singleSelect ? [next] : [...current, next]);
      }
    },
    [onChange, singleSelect],
  );

  const updateItemValues = useCallback(
    (item: FilterItem, values: string[] | null) => {
      const key = getKey(item);
      const current = selectedItemsRef.current;
      const existing = current.find(s => getKey(s) === key);
      if (existing) {
        onChange(current.map(s => (getKey(s) === key ? { ...s, values } : s)));
      } else {
        onChange([...current, { id: item.id, name: item.name, values }]);
      }
    },
    [onChange],
  );

  const listHeight = Math.min(virtualizer.getTotalSize(), MAX_LIST_HEIGHT);

  const showSearch = alwaysShowSearch || items.length >= SEARCH_VISIBILITY_THRESHOLD;

  const allNames = useMemo(() => items.map(item => item.name).join('\n'), [items]);
  const hasSubmenus = items.some(item => item.values.length > 0);

  return (
    // Modest min-width so the popover doesn't collapse to a single 1–2 char
    // item, but still sizes naturally to fit the content of small lists.
    <div role="group" className={`${styles.filterContentDiv} ${menuPanelInset}`}>
      {/*
        Only the rows in view are in the DOM, so left to itself the popup would size to whichever
        happen to be rendered. This zero-height row carries every name, one per line, so the popup
        is as wide as its widest item (up to the popup's max-width) from the start and stays put
        through scrolling and search. Laid out like an ItemRow: checkbox, gap, name, chevron.
      */}
      <div aria-hidden className={styles.filterContentDiv2}>
        <span className={styles.filterContentSpan} />
        <span className={styles.filterContentSpan2}>{allNames}</span>
        {hasSubmenus ? <span className={styles.filterContentSpan3} /> : null}
      </div>
      {showSearch && <FloatingSearch label={label} onSearch={setSearch} value={search} />}
      {/* Note about unavailable items */}
      {items.some(item => item.unavailable) && (
        <div className={styles.filterContentDiv3}>
          <span className={styles.filterContentSpan4}>Struck-through</span> items are not found in
          the selected date range.
        </div>
      )}

      {/* Item list */}
      {filteredItems.length > 0 ? (
        <div
          ref={scrollRef}
          className={styles.filterContentDiv4}
          style={{
            height: listHeight,
            overflow: 'auto',
            scrollbarColor: 'var(--color-neutral-7) transparent',
            scrollbarWidth: 'thin',
          }}
        >
          <div style={{ height: virtualizer.getTotalSize() }}>
            <div
              style={{
                transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
              }}
            >
              <ListScrollContext.Provider value={scrollRef}>
                {virtualizer.getVirtualItems().map(virtualItem => {
                  const item = filteredItems[virtualItem.index];
                  const selected = isItemSelected(item, selectedItems);
                  const selection = getItemSelection(item, selectedItems);
                  const hasPartialValues =
                    selected && selection?.values !== null && (selection?.values?.length ?? 0) > 0;

                  return (
                    <div key={getKey(item)} style={{ height: virtualItem.size }}>
                      <ItemRow
                        item={item}
                        selected={selected}
                        indeterminate={hasPartialValues}
                        onToggle={toggleItem}
                        selection={selection}
                        onValuesChange={updateItemValues}
                        valuesLabel={valuesLabel}
                        unavailable={item.unavailable}
                      />
                    </div>
                  );
                })}
              </ListScrollContext.Provider>
            </div>
          </div>
        </div>
      ) : (
        <div className={floatingEmptyState}>No items found</div>
      )}
    </div>
  );
}
