import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { FloatingSearch } from '../../primitives/floating/floating-search';
import { MenuItem } from '../../primitives/floating/menu/menu';
import {
  floatingEmptyState,
  floatingScrollArea,
  menuPanelInset,
} from '../../primitives/floating/shared-styles';
import { SEARCH_VISIBILITY_THRESHOLD } from './filter-content';
import * as styles from './values-sub-panel.css';

type ValuesSubPanelProps = {
  itemName: string;
  values: string[];
  selectedValues: string[] | null; // null = all values
  onValuesChange: (values: string[] | null) => void;
  valuesLabel: string;
};

export function ValuesSubPanel({
  itemName,
  values,
  selectedValues,
  onValuesChange,
  valuesLabel,
}: ValuesSubPanelProps) {
  const [search, setSearch] = useState('');

  const allSelected = selectedValues === null;

  const filteredValues = useMemo(
    () => values.filter(v => v.toLowerCase().includes(search.toLowerCase())),
    [values, search],
  );

  function isValueSelected(val: string) {
    if (selectedValues === null) return true;
    return selectedValues.includes(val);
  }

  function toggleValue(val: string) {
    if (selectedValues === null) {
      // Was "all" → deselect this one, select all others
      onValuesChange(values.filter(v => v !== val));
    } else if (selectedValues.includes(val)) {
      const next = selectedValues.filter(v => v !== val);
      onValuesChange(next.length === 0 ? [] : next);
    } else {
      const next = [...selectedValues, val];
      // If all selected, switch back to null (all)
      onValuesChange(next.length === values.length ? null : next);
    }
  }

  function toggleAllValues() {
    if (allSelected) {
      onValuesChange([]);
    } else {
      onValuesChange(null);
    }
  }

  const showSearch = values.length >= SEARCH_VISIBILITY_THRESHOLD;

  return (
    <div className={menuPanelInset}>
      {showSearch && (
        <FloatingSearch
          label={`Search ${valuesLabel} for ${itemName}`}
          onSearch={setSearch}
          value={search}
        />
      )}

      {/* Values list */}
      <div className={`${styles.valuesSubPanelDiv} ${floatingScrollArea}`}>
        {/* All values toggle */}
        <MenuItem closeOnClick={false} onClick={toggleAllValues}>
          <Checkbox checked={allSelected} size="sm" visual />
          <span>All {valuesLabel}</span>
        </MenuItem>

        {/* Individual values */}
        {filteredValues.map(val => {
          const checked = isValueSelected(val);
          return (
            <MenuItem key={val} closeOnClick={false} onClick={() => toggleValue(val)}>
              <Checkbox checked={checked} size="sm" visual />
              <span className={styles.valuesSubPanelSpan}>{val}</span>
            </MenuItem>
          );
        })}
        {filteredValues.length === 0 && (
          <div className={floatingEmptyState}>No {valuesLabel} found</div>
        )}
      </div>
    </div>
  );
}
