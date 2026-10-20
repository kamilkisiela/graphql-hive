import { createPreview, type NavPath } from 'react-foundry';
import { PagePending, SectionPending } from './page-pending';
import * as styles from './page-pending.preview.css';

export const nav: NavPath = 'Components/PagePending';

export const Page = createPreview(() => (
  <div className={styles.div}>
    <PagePending />
  </div>
));

// Beside a versions list, where the history index waits to redirect.
export const Section = createPreview(() => (
  <div className={styles.div2}>
    <div className={styles.div3}>
      <span className={styles.span}>rev-a1b2c3</span>
      <span>rev-b2c3d4</span>
      <span>rev-c3d4e5</span>
    </div>
    <SectionPending />
  </div>
));
