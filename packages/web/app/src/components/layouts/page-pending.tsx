import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { LayoutContent } from './layout-content';
import * as styles from './page-pending.css';

// The route is still deciding what the page is, so nothing here promises a shape.
export function PagePending() {
  return (
    <LayoutContent className={styles.pagePendingLayoutContent}>
      <Spinner variants={{ size: 'lg' }} />
    </LayoutContent>
  );
}

// A pane or section deciding inside a page that already rendered.
export function SectionPending() {
  return (
    <div className={styles.sectionPendingDiv}>
      <Spinner variants={{ size: 'lg' }} />
    </div>
  );
}
