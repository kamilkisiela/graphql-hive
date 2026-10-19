import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import * as styles from './page.css';

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn(styles.titleH3, className)}>{children}</h3>;
}

export function Subtitle({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(styles.subtitleP, className)}>{children}</p>;
}
