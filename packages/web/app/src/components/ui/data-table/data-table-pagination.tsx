import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../primitives/input/input';
import { Spinner } from '../primitives/spinner/spinner';
import * as styles from './data-table-pagination.css';

export type DataTablePaginationProps = {
  pageIndex: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

const barClass = styles.barClass;

const arrowClass = styles.arrowClass;

const wordClass = styles.wordClass;

/**
 * First, previous, next and last with the page position between them and a field to jump to a
 * page, for data the client holds in full.
 */
export function DataTablePagination({
  pageIndex,
  pageCount,
  onPageChange,
}: DataTablePaginationProps) {
  const [draft, setDraft] = useState(String(pageIndex + 1));
  useEffect(() => {
    setDraft(String(pageIndex + 1));
  }, [pageIndex]);

  if (pageCount <= 1) return null;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  const jump = () => {
    const page = Number.parseInt(draft, 10);
    if (Number.isNaN(page)) {
      setDraft(String(pageIndex + 1));
      return;
    }
    onPageChange(Math.min(pageCount - 1, Math.max(0, page - 1)));
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`${barClass} ${styles.dataTablePaginationNav}`}
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(0)}
        className={wordClass}
      >
        First
      </button>
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => onPageChange(pageIndex - 1)}
        className={arrowClass}
      >
        <ChevronLeft className={styles.dataTablePaginationChevronLeft} />
      </button>
      <span className={styles.dataTablePaginationSpan} aria-live="polite">
        {pageIndex + 1} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={!canNext}
        onClick={() => onPageChange(pageIndex + 1)}
        className={arrowClass}
      >
        <ChevronRight className={styles.dataTablePaginationChevronRight} />
      </button>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(pageCount - 1)}
        className={wordClass}
      >
        Last
      </button>
      <label className={styles.dataTablePaginationLabel}>
        Go to
        <Input
          size="compact"
          width="xs"
          type="number"
          min={1}
          max={pageCount}
          value={draft}
          aria-label="Go to page"
          onChange={event => setDraft(event.target.value)}
          onBlur={jump}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              // A table inside a form must not submit it from here.
              event.preventDefault();
              jump();
            }
          }}
        />
      </label>
    </nav>
  );
}

export type DataTableCursorPaginationProps = {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** What the page holds, such as "Showing 20 of 143 deployments". */
  summary?: ReactNode;
  loading?: boolean;
};

/**
 * Previous and next, for a cursor connection the API pages with `first` and `after`. There are
 * no page numbers because the API has no offsets to give.
 */
export function DataTableCursorPagination({
  hasPreviousPage,
  hasNextPage,
  onPrevious,
  onNext,
  summary,
  loading = false,
}: DataTableCursorPaginationProps) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`${barClass} ${styles.dataTableCursorPaginationNav}`}
    >
      <span className={styles.dataTableCursorPaginationSpan}>{summary}</span>
      <span className={styles.dataTableCursorPaginationSpan2}>
        {loading ? <Spinner variants={{ size: 'sm' }} /> : null}
        <button
          type="button"
          aria-label="Previous page"
          disabled={!hasPreviousPage || loading}
          onClick={onPrevious}
          className={arrowClass}
        >
          <ChevronLeft className={styles.dataTableCursorPaginationChevronLeft} />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={!hasNextPage || loading}
          onClick={onNext}
          className={arrowClass}
        >
          <ChevronRight className={styles.dataTableCursorPaginationChevronRight} />
        </button>
      </span>
    </nav>
  );
}
