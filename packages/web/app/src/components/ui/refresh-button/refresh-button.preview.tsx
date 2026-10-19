import { createPreview, type NavPath } from 'react-foundry';
import { RefreshButton } from './refresh-button';
import * as styles from './refresh-button.preview.css';

export const nav: NavPath = 'Components/RefreshButton';

// The one Refresh control, as a filter row and a page header mount it.
export const Refresh = createPreview(() => (
  <div className={styles.div}>
    <RefreshButton onClick={() => {}} />
    <RefreshButton size="compact" onClick={() => {}} />
    <RefreshButton disabled onClick={() => {}} />
  </div>
));
