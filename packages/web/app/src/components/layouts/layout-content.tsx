import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import * as styles from './layout-content.css';

/** The content column under a layout's header and nav; every page renders one around its content. */
export function LayoutContent(props: { className?: string; children: ReactNode }) {
  return <div className={cn(styles.layoutContentDiv, props.className)}>{props.children}</div>;
}
