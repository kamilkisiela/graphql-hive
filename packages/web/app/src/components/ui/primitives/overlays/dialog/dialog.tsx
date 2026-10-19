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
import * as styles from './dialog.css';

const widthClass = {
  sm: styles.widthClassSm,
  md: styles.widthClassMd,
  lg: styles.widthClassLg,
  xl: styles.widthClassXl,
} as const;

const popupClass = cn(
  popupSurfaceClass,
  styles.class2,
  styles.class3,
  styles.class4,
  styles.class5,
);

/** Why the dialog is opening or closing, with `cancel()` to keep it where it is. */
export type DialogChangeEventDetails = BaseDialog.Root.ChangeEventDetails;

export type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: DialogChangeEventDetails) => void;
  /**
   * Fires once the open or close transition has finished. The place to reset a form after a
   * close, since resetting on `onOpenChange` would show the reset mid-transition.
   */
  onOpenChangeComplete?: (open: boolean) => void;
  /** What opens the dialog. Optional: most dialogs are opened by state set somewhere else. */
  trigger?: FloatingProps['trigger'];
  title: ReactNode;
  description?: ReactNode;
  /** The body. It scrolls on its own once the dialog reaches the viewport height. */
  children?: ReactNode;
  /** Actions, laid out right-aligned. */
  footer?: ReactNode;
  width?: keyof typeof widthClass;
  /** The × in the corner. Off for a dialog that has to be answered, such as the prompt. */
  closeButton?: boolean;
  /** Clicking the backdrop closes the dialog. Off for a form a stray click would lose. */
  dismissible?: boolean;
  attrs?: Record<string, string>;
};

export function Dialog({
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
  closeButton = true,
  dismissible = true,
  attrs,
}: DialogProps) {
  // Handed to the portal-container context, so base menus, selects and tooltips inside the dialog
  // render their popups into it rather than into `<body>`, which a modal dialog makes inert.
  const [portalMount, setPortalMount] = useState<HTMLElement | null>(null);

  return (
    <BaseDialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      disablePointerDismissal={!dismissible}
    >
      {trigger ? <BaseDialog.Trigger render={trigger as ReactElement} /> : null}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdropClass} />
        <BaseDialog.Popup className={cn(popupClass, widthClass[width])} {...attrs}>
          <FloatingPortalContainerProvider container={portalMount}>
            <OverlayHeader title={title} description={description} clearCloseButton={closeButton} />
            {children != null ? (
              <OverlayBody padding="default" padBottom={footer == null}>
                {children}
              </OverlayBody>
            ) : null}
            {footer != null ? <OverlayFooter>{footer}</OverlayFooter> : null}
            {closeButton ? <OverlayCloseButton /> : null}
          </FloatingPortalContainerProvider>
          <OverlayPortalMount mountRef={setPortalMount} />
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
