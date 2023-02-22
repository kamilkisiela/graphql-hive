import { ReactElement } from 'react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }): ReactElement {
  return (
    // Copied from https://chakra-ui.com/docs/components/spinner#usage
    <div
      className={clsx(
        'text-orange-500 animate-spin w-6 h-6 rounded-full',
        'border-t-current border-r-current border-2 border-l-transparent border-b-transparent',
        '[animation-duration:0.45s]',
        className,
      )}
    >
      <span className="absolute [clip:rect(0,0,0,0)]">Loading...</span>
    </div>
  );
}
