import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button/button';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { useClipboard } from '@/lib/hooks';
import * as styles from './copy-icon-button.css';

type CopyIconButtonProps = {
  label: string;
  value: string;
};

export function CopyIconButton(props: CopyIconButtonProps) {
  const clipboard = useClipboard();
  return (
    <Tooltip
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={props.label}
          onClick={() => clipboard(props.value)}
        >
          <CopyIcon className={styles.copyIconButtonCopyIcon} />
        </Button>
      }
      content={props.label}
      disableHoverablePopup
    />
  );
}
