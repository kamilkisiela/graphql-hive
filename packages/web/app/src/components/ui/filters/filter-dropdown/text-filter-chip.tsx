import { X } from 'lucide-react';
import { segmentButton, segmentSeparator } from '@/components/ui/primitives/shared-styles';
import { FloatingSearch } from '../../primitives/floating/floating-search';
import { Menu } from '../../primitives/floating/menu/menu';
import { chipClass, chipRemoveButtonClass } from './filter-dropdown';
import * as styles from './text-filter-chip.css';

export type TextFilterChipProps = {
  /** Singular label shown on the leading segment. */
  label: string;
  /** Current value. Rendered as the chip's middle segment. */
  value: string;
  onChange: (next: string) => void;
  /** Called when the chip's X is clicked. */
  onRemove: () => void;
  placeholder?: string;
};

/**
 * The free-text counterpart to `FilterDropdown`: a `Label | value | X` pill
 * whose middle segment opens an input to edit the value in place.
 */
export function TextFilterChip({
  label,
  value,
  onChange,
  onRemove,
  placeholder,
}: TextFilterChipProps) {
  return (
    <div role="group" aria-label={`${label} filter`} className={chipClass}>
      <span className={styles.textFilterChipSpan}>{label}</span>

      <span className={segmentSeparator}>
        <Menu
          trigger={
            <button
              type="button"
              className={`${segmentButton} ${styles.textFilterChipButton}`}
              title={value}
            >
              {value}
            </button>
          }
          modal={false}
          side="bottom"
          align="start"
          maxWidth="lg"
          content={
            <FloatingSearch
              label={label}
              value={value}
              onSearch={onChange}
              placeholder={placeholder}
              standalone
            />
          }
        />
      </span>

      <button
        type="button"
        className={`${segmentSeparator} ${chipRemoveButtonClass}`}
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
      >
        <X className={styles.textFilterChipX} />
      </button>
    </div>
  );
}
