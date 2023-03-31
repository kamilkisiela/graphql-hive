import { ReactElement } from 'react';
import { clsx } from 'clsx';
import { sanitize } from 'dompurify';
import snarkdown from 'snarkdown';

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}): ReactElement {
  return (
    <div
      className={clsx('hive-markdown', className)}
      dangerouslySetInnerHTML={{ __html: sanitize(snarkdown(content)) }}
    />
  );
}
