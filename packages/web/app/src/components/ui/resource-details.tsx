import { ReactElement } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { InputCopy } from './input-copy';
import * as styles from './resource-details.css';

/** Renders readonly properties for resources. Used on settings pages. */
export function ResourceDetails(props: { id: string; label: string }): ReactElement {
  return (
    <div className={styles.resourceDetailsDiv}>
      <InputCopy value={props.id} prefixText={props.label} />
      <Tooltip
        trigger={
          <button
            type="button"
            aria-label="What this ID is for"
            className={styles.resourceDetailsButton}
          >
            <Info className={styles.resourceDetailsInfo} />
          </button>
        }
        maxWidth="md"
        content='This UUID can be used in API calls or CLI commands to Hive instead of passing the full resource path. I.e. "org/project/target".'
      />
    </div>
  );
}
