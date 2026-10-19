import { cn } from '@/lib/utils';
import * as styles from './floating-search.css';

type FloatingSearchProps = {
  label: string;
  onSearch: (value: string) => void;
  value: string;
  placeholder?: string;
  /**
   * The input is the panel's only content, rather than a header above a list. Such a panel has no
   * padding of its own, so there is none for the `-mx-2` bleed to cancel, and all four corners
   * round since there's no list below to divide from.
   */
  standalone?: boolean;
};

export function FloatingSearch({
  label,
  onSearch,
  value,
  placeholder = 'Search...',
  standalone = false,
}: FloatingSearchProps) {
  return (
    <div className={cn(styles.floatingSearchDiv, !standalone && styles.floatingSearchDiv2)}>
      <input
        type="text"
        role="searchbox"
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onSearch(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Escape') {
            e.stopPropagation();
          }
        }}
        className={cn(
          styles.floatingSearchInput,
          standalone ? styles.floatingSearchInput2 : styles.floatingSearchInput3,
        )}
      />
    </div>
  );
}
