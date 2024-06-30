import { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const colors = {
  green: 'bg-green-500/10 text-green-500',
  yellow: 'bg-yellow-500/10 text-yellow-500',
  gray: 'bg-gray-500/10 text-gray-500',
} as const;

export function Tag({
  children,
  color = 'gray',
  className,
}: {
  color?: 'green' | 'yellow' | 'gray';
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <span
      className={cn('inline-flex items-center gap-x-1 rounded-sm p-2', colors[color], className)}
    >
      {children}
    </span>
  );
}
