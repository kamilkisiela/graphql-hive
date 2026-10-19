import { ReactNode, useRef } from 'react';
import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button/button';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { useClipboard } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import * as styles from './copy-text.css';

export function CopyText(props: { children: ReactNode; copy?: string; className?: string }) {
  const copyToClipboard = useClipboard();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={cn(styles.copyTextDiv, 'group', props.className)}>
      <div ref={ref} className={styles.copyTextDiv2}>
        {props.children}
      </div>
      <span className={styles.copyTextSpan}>
        <Tooltip
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy"
              onClick={async () => {
                await copyToClipboard(props.copy ?? ref.current?.innerText ?? '');
              }}
            >
              <CopyIcon className={styles.copyTextCopyIcon} />
            </Button>
          }
          content="Copy"
        />
      </span>
    </div>
  );
}
