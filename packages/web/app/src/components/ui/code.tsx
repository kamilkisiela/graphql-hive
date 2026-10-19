import { useRef, type ComponentProps, type FC } from 'react';
import cn from 'clsx';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useHover } from '@/lib/hooks/use-hover';
import { useTimed } from '@/lib/hooks/use-timed';
import * as styles from './code.css';

export const Code: FC<ComponentProps<'code'>> = ({ children, className, ...props }) => {
  const [copied, startCopyTimer] = useTimed(1500);
  const [ref, hovering] = useHover();
  const codeRef = useRef<HTMLElement | null>(null);
  // in case this browser does not support this newer API...
  const navigatorClipboardSupport = typeof navigator.clipboard?.writeText === 'function';
  return (
    <span
      ref={ref}
      className={styles.codeSpan}
      // Make this element able to be focused by setting tabIndex.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onFocus={() => {
        if (codeRef.current) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.setStart(codeRef.current, 0);
          range.setEnd(codeRef.current, codeRef.current.childNodes.length);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }}
    >
      <code
        ref={codeRef}
        className={cn(styles.codeCode, className)}
        // always show code blocks in ltr
        dir="ltr"
        {...props}
      >
        {children}
      </code>
      <button
        hidden={!navigatorClipboardSupport}
        data-hovering={hovering || copied}
        className={styles.codeButton}
        onClick={async ev => {
          const value = children?.valueOf().toString();
          if (value) {
            ev.preventDefault();
            await navigator.clipboard.writeText(value);
            startCopyTimer();
          }
        }}
        title="Copy to clipboard"
      >
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      </button>
    </span>
  );
};
