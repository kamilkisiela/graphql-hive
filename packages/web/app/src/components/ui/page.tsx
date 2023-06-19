import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)}>{children}</h3>;
}

export function Subtitle({ children, className }: { children: string; className?: string }) {
  return <p className={cn('text-sm text-gray-400', className)}>{children}</p>;
}
