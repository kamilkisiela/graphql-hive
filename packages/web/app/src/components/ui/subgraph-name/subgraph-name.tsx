import { PackageIcon } from 'lucide-react';
import * as styles from './subgraph-name.css';

/**
 * A subgraph's name wherever the UI mentions one. Neutral, not a semantic colour, so it never reads
 * as a verdict next to the warning and critical badges it tends to sit beside.
 */
export function SubgraphName(props: { name: string }) {
  return (
    <span className={styles.subgraphNameSpan} title={props.name}>
      <span className={styles.subgraphNameSpan2}>
        <PackageIcon className={styles.subgraphNamePackageIcon} />
      </span>
      <span className={styles.subgraphNameSpan3}>{props.name}</span>
    </span>
  );
}
