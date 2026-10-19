import React from 'react';
import { clsx } from 'clsx';
import * as styles from './dotted-background.css';

export function DottedBackground(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx(styles.dottedBackgroundDiv, props.className)}>
      <div className={styles.dottedBackgroundDiv2} />
      {props.children}
    </div>
  );
}
