import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button/button';
import { Input } from '@/components/ui/primitives/input/input';
import type { OnSurface } from '@/components/ui/primitives/shared-styles';
import { Textarea } from '@/components/ui/primitives/textarea/textarea';
import { useClipboard } from '@/lib/hooks';
import * as styles from './input-copy.css';

export function InputCopy(props: {
  value: string;
  multiline?: boolean;
  prefixText?: string;
  /** `raised` inside a dialog, a sheet or a raised card, like any other field there. */
  onSurface?: OnSurface;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = useClipboard();

  useEffect(() => {
    if (!isCopied) return;
    const timerId = setTimeout(() => {
      setIsCopied(false);
    }, 2000);

    return () => {
      clearTimeout(timerId);
    };
  }, [isCopied]);

  const handleClick = useCallback(async () => {
    await copyToClipboard(props.value);
    setIsCopied(true);
  }, [copyToClipboard, props.value]);

  return (
    <div className={styles.inputCopyDiv}>
      {props.multiline ? (
        <Textarea
          value={props.value}
          readOnly
          autoSize
          mono
          onSurface={props.onSurface}
          onFocus={ev => ev.target.select()}
        />
      ) : (
        <div className={styles.inputCopyDiv2}>
          <Input
            type="text"
            value={props.value}
            readOnly
            mono
            onSurface={props.onSurface}
            prefixText={props.prefixText}
            onFocus={ev => ev.target.select()}
          />
        </div>
      )}
      <div className={styles.inputCopyDiv3}>
        <Button
          type="button"
          onClick={handleClick}
          variant="outline"
          layout="iconOnly"
          icon={isCopied ? CheckIcon : CopyIcon}
          aria-label={isCopied ? 'Copied' : 'Copy'}
        />
      </div>
    </div>
  );
}
