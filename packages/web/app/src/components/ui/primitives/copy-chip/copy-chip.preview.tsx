import { createPreview, NavPath } from 'react-foundry';
import { CopyChip } from './copy-chip';
import * as styles from './copy-chip.preview.css';

export const nav: NavPath = 'Primitives/CopyChip';

export const Default = createPreview(() => (
  <div className={styles.div}>
    <CopyChip value="I like turtles" label="Click me to copy some text" />
  </div>
));
