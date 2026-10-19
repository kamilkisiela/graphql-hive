import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Button } from '../button/button';
import { ScrollArea } from '../scroll-area/scroll-area';
import * as styles from './overlay-parts.css';

/**
 * The parts a dialog, a sheet and an alert dialog share, so the three read as one family: the
 * backdrop, the header and footer treatment, the scrolling body and the close button in the
 * corner. Base UI's alert dialog re-exports the dialog's title, description and close parts, so
 * these render inside either root.
 */

// Base UI sets `data-starting-style` on the frame a popup mounts and `data-ending-style` while it
// leaves, so one CSS transition covers both directions.
export const backdropClass = styles.backdropClass;

export const popupSurfaceClass = styles.popupSurfaceClass;

/**
 * Where menus, selects and tooltips opened inside the overlay portal to. Base UI appends a plain
 * wrapper div into the container for each popup; as a flex item of the popup that wrapper would
 * take a gap, shifting a centred dialog by half of it every time a tooltip opens and closes. The
 * mount keeps the popup's width, since a popup wraps its text to its containing block's width.
 */
export function OverlayPortalMount({ mountRef }: { mountRef: (node: HTMLElement | null) => void }) {
  return <div ref={mountRef} className={styles.overlayPortalMountDiv} data-overlay-portal-mount />;
}

export function OverlayHeader({
  title,
  description,
  clearCloseButton,
}: {
  title: ReactNode;
  /**
   * The accessible description, read out in full right after the title when the overlay opens.
   * One short passage of inline content; a second paragraph or a control belongs in the body.
   * It stays a `<p>` so block content inside it trips React's nesting warning in dev.
   */
  description?: ReactNode;
  /** Leave room on the right for the close button. */
  clearCloseButton: boolean;
}) {
  return (
    <div className={cn(styles.overlayHeaderDiv, clearCloseButton && styles.overlayHeaderDiv2)}>
      <BaseDialog.Title className={styles.overlayHeaderTitle}>{title}</BaseDialog.Title>
      {description != null ? (
        <BaseDialog.Description className={styles.overlayHeaderDescription}>
          {description}
        </BaseDialog.Description>
      ) : null}
    </div>
  );
}

export function OverlayBody({
  children,
  padding,
  padBottom,
}: {
  children: ReactNode;
  /**
   * `none` for content that lays itself out edge to edge and owns its scrolling: a trace tree, a
   * tab strip over a list, a code editor. It gets the remaining height as a flex column and no
   * scroll area of its own.
   */
  padding: 'default' | 'none';
  /** When nothing follows the body, it carries the bottom inset itself. */
  padBottom: boolean;
}) {
  if (padding === 'none') {
    return <div className={styles.overlayBodyDiv}>{children}</div>;
  }
  return (
    <ScrollArea fill>
      <div className={cn(styles.overlayBodyDiv2, padBottom && styles.overlayBodyDiv3)}>
        {children}
      </div>
    </ScrollArea>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return <div className={styles.overlayFooterDiv}>{children}</div>;
}

export function OverlayCloseButton() {
  return (
    <span className={styles.overlayCloseButtonSpan}>
      <BaseDialog.Close
        render={
          <Button layout="iconOnly" icon={X} aria-label="Close" variant="ghost" size="icon-sm" />
        }
      />
    </span>
  );
}
