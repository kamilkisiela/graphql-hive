import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { FloatingPortalContainerProvider } from '../../floating/floating-portal-container';
import type { FloatingProps } from '../../floating/shared-styles';
import {
  backdropClass,
  OverlayBody,
  OverlayCloseButton,
  OverlayFooter,
  OverlayHeader,
  OverlayPortalMount,
  popupSurfaceClass,
} from '../overlay-parts';
import * as styles from './sheet.css';

const widthClass = {
  md: styles.widthClassMd,
  lg: styles.widthClassLg,
  half: styles.widthClassHalf,
} as const;

const popupClass = cn(
  popupSurfaceClass,
  styles.class2,
  styles.class3,
  styles.class4,
  styles.class5,
);

export type SheetProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fires once the open or close transition has finished; see Dialog. */
  onOpenChangeComplete?: (open: boolean) => void;
  /** What opens the sheet. Optional: most sheets are opened by state set somewhere else. */
  trigger?: FloatingProps['trigger'];
  title: ReactNode;
  description?: ReactNode;
  /** The body. The header and footer stay put; this scrolls. */
  children?: ReactNode;
  /** Actions, pinned to the bottom edge. */
  footer?: ReactNode;
  width?: keyof typeof widthClass;
  /**
   * `none` for a body that lays itself out edge to edge and scrolls on its own, such as a trace
   * tree or a tab strip over a list. It gets the remaining height as a flex column.
   */
  padding?: 'default' | 'none';
  attrs?: Record<string, string>;
};

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  onOpenChangeComplete,
  trigger,
  title,
  description,
  children,
  footer,
  width = 'md',
  padding = 'default',
  attrs,
}: SheetProps) {
  // See Dialog: base menus, selects and tooltips inside the sheet render their popups into it.
  const [portalMount, setPortalMount] = useState<HTMLElement | null>(null);

  return (
    <BaseDialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {trigger ? <BaseDialog.Trigger render={trigger as ReactElement} /> : null}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdropClass} />
        <BaseDialog.Popup className={cn(popupClass, widthClass[width])} {...attrs}>
          <FloatingPortalContainerProvider container={portalMount}>
            <OverlayHeader title={title} description={description} clearCloseButton />
            {children != null ? (
              <OverlayBody padding={padding} padBottom={footer == null && padding === 'default'}>
                {children}
              </OverlayBody>
            ) : null}
            {footer != null ? <OverlayFooter>{footer}</OverlayFooter> : null}
            <OverlayCloseButton />
          </FloatingPortalContainerProvider>
          <OverlayPortalMount mountRef={setPortalMount} />
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
