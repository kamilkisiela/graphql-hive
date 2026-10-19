import { type ReactNode, type Ref } from 'react';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import * as styles from './collapsible.css';

const headerVariants = lenient(styles.headerVariants);

const triggerVariants = lenient(styles.triggerVariants);

type CollapsibleProps = {
  /**
   * `section` is a group heading that toggles the list beneath it, as in a filter column.
   * `panel` is the header bar of a titled panel, with room for actions at its trailing edge.
   */
  variant?: 'section' | 'panel';
  /** The heading. Rendered inside the button, after the chevron. */
  trigger: ReactNode;
  /** Controls at the trailing edge of the header, outside the button, such as a reset or clear. */
  actions?: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  /** The panel element, for code that scrolls it. */
  panelRef?: Ref<HTMLDivElement>;
  panelDataCy?: string;
};

export function Collapsible({
  variant = 'section',
  trigger,
  actions,
  children,
  open,
  defaultOpen,
  onOpenChange,
  id,
  panelRef,
  panelDataCy,
}: CollapsibleProps) {
  return (
    <BaseCollapsible.Root
      id={id}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? next => onOpenChange(next) : undefined}
      className={clsx(styles.collapsibleRoot, 'group/collapsible')}
    >
      <div className={headerVariants({ variant })}>
        <BaseCollapsible.Trigger className={triggerVariants({ variant })}>
          <ChevronRight className={styles.collapsibleChevronRight} />
          <span className={styles.collapsibleSpan}>{trigger}</span>
        </BaseCollapsible.Trigger>
        {actions}
      </div>
      <BaseCollapsible.Panel
        ref={panelRef}
        data-cy={panelDataCy}
        className={styles.collapsiblePanel}
      >
        {children}
      </BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  );
}
