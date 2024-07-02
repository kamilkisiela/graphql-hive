import { ReactElement, useCallback, useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/v2/icon';
import { useClipboard } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

export const CopyValue = ({
  value,
  className,
}: {
  value: string;
  className?: string;
}): ReactElement => {
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
    await copyToClipboard(value);
    setIsCopied(true);
  }, [value, copyToClipboard]);

  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        readOnly
        className="pr-10" // Adjust padding to make room for the button
      />
      <Button
        size="icon"
        variant="link"
        className="absolute right-0 top-0 p-2 focus:ring-transparent"
        onClick={handleClick}
        title={isCopied ? 'Copied!' : 'Copy to clipboard'}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
};
