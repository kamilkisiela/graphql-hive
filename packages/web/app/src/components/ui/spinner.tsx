import { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export const Spinner = ({ className }: { className?: string }): ReactElement => {
  return (
    // Copied from https://chakra-ui.com/docs/components/spinner#usage
    <div
      className={cn(
        'size-6 animate-spin rounded-full text-orange-500',
        'border-2 border-b-transparent border-l-transparent border-r-current border-t-current',
        '[animation-duration:0.45s]',
        className,
      )}
    >
      <span className="absolute [clip:rect(0,0,0,0)]">Loading...</span>
    </div>
  );
};
