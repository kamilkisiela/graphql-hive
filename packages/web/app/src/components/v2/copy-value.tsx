import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Button, Input } from '@/components/v2';
import { CheckIcon, CopyIcon } from '@/components/v2/icon';
import { useClipboard } from '@/lib/hooks';

export const CopyValue = ({
  value,
  className,
}: {
  value: string;
  className?: string;
}): ReactElement => {
  const [isCopied, setCopied] = useState(false);
  const copyToClipboard = useClipboard();

  useEffect(() => {
    if (!isCopied) return;
    const timerId = setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      clearTimeout(timerId);
    };
  }, [isCopied]);

  const handleClick = useCallback(async () => {
    await copyToClipboard(value);
    setCopied(true);
  }, [value, copyToClipboard]);

  return (
    <Input
      className={className}
      value={value}
      readOnly
      suffix={
        <Button
          className="p-0 focus:ring-transparent"
          onClick={handleClick}
          title={isCopied ? 'Copied!' : 'Copy to clipboard'}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      }
    />
  );
};
