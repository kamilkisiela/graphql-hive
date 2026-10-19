import { createContext, memo, useContext, useEffect, useState, type RefObject } from 'react';
import { ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { Menu, MenuItem } from '../../primitives/floating/menu/menu';
import type { FilterItem, FilterSelection } from './types';
import { ValuesSubPanel } from './values-sub-panel';
import * as styles from './item-row.css';

/** The list's scroll container, so a row can close its values panel when the list scrolls. */
export const ListScrollContext = createContext<RefObject<HTMLDivElement> | null>(null);

interface ItemRowProps {
  item: FilterItem;
  selected: boolean;
  indeterminate: boolean;
  onToggle: (item: FilterItem) => void;
  selection: FilterSelection | null;
  onValuesChange: (item: FilterItem, values: string[] | null) => void;
  valuesLabel: string;
  unavailable?: boolean;
}

function ItemName({ name, unavailable }: { name: string; unavailable?: boolean }) {
  return (
    <span
      className={`${styles.itemNameSpan} ${unavailable ? styles.itemNameSpan2 : ''}`}
      title={name}
    >
      {name}
    </span>
  );
}

export const ItemRow = memo(function ItemRow({
  item,
  selected,
  indeterminate,
  onToggle,
  selection,
  onValuesChange,
  valuesLabel,
  unavailable,
}: ItemRowProps) {
  const hasValues = item.values.length > 0;
  const scrollRef = useContext(ListScrollContext);
  const [open, setOpen] = useState(false);

  // Scrolling the list moves the pointer off the row that opened the panel.
  useEffect(() => {
    const list = scrollRef?.current;
    if (!open || !list) return;

    const close = () => setOpen(false);
    list.addEventListener('scroll', close, { passive: true });
    return () => list.removeEventListener('scroll', close);
  }, [open, scrollRef]);

  if (!hasValues) {
    return (
      <MenuItem closeOnClick={false} onClick={() => onToggle(item)}>
        <Checkbox checked={selected} indeterminate={indeterminate} size="sm" visual />
        <ItemName name={item.name} unavailable={unavailable} />
      </MenuItem>
    );
  }

  return (
    <Menu
      submenu
      open={open}
      onOpenChange={setOpen}
      trigger={
        <div onClick={() => onToggle(item)}>
          <Checkbox checked={selected} indeterminate={indeterminate} size="sm" visual />
          <ItemName name={item.name} unavailable={unavailable} />
          <ChevronRight className={styles.itemRowChevronRight} />
        </div>
      }
      openOnHover
      delay={100}
      closeDelay={150}
      content={
        <ValuesSubPanel
          itemName={item.name}
          values={item.values}
          selectedValues={selected ? (selection?.values ?? null) : []}
          onValuesChange={values => onValuesChange(item, values)}
          valuesLabel={valuesLabel}
        />
      }
    />
  );
});
