import { ReactElement } from 'react';
import clsx from 'clsx';
import * as styles from './policy-config-box.css';

type Props = {
  className?: string;
} & { children: React.ReactNode; title?: ReactElement | string };

export function PolicyConfigBox(props: Props) {
  return (
    <div
      className={clsx(
        styles.policyConfigBoxDiv,
        'title' in props ? undefined : styles.policyConfigBoxDiv2,
        props.className,
      )}
    >
      {'title' in props ? (
        <>
          <div className={styles.policyConfigBoxDiv3}>{props.title}</div>
          <div>{props.children}</div>
        </>
      ) : (
        props.children
      )}
    </div>
  );
}
