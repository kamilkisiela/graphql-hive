import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, Copy } from 'lucide-react';
import * as styles from './copy-chip.css';

export function CopyChip(props: {
  value: string;
  label?: string;
  /** Attributes for the text, such as a hook for a test. */
  attrs?: Record<string, string>;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cleanPendingTimer() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
  }

  useEffect(() => cleanPendingTimer, []);

  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(props.value);
        setCopied(true);
        cleanPendingTimer();
        timeoutRef.current = setTimeout(() => setCopied(false), 1200);
      }}
      className={clsx(styles.copyChipButton, 'group')}
    >
      <span className={styles.copyChipSpan} {...props.attrs}>
        {props.label ?? props.value}
      </span>
      {copied ? (
        <Check className={styles.copyChipCheck} />
      ) : (
        <Copy className={styles.copyChipCopy} />
      )}
    </button>
  );
}
