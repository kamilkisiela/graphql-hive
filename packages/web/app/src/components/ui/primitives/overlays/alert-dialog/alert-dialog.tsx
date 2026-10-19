import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from '../../button/button';
import type { FloatingProps } from '../../floating/shared-styles';
import {
  backdropClass,
  OverlayBody,
  OverlayFooter,
  OverlayHeader,
  popupSurfaceClass,
} from '../overlay-parts';
import * as styles from './alert-dialog.css';

const popupClass = cn(
  popupSurfaceClass,
  styles.class2,
  styles.class3,
  styles.class4,
  styles.class5,
);

export type AlertDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fires once the open or close transition has finished, so state can reset after a close. */
  onOpenChangeComplete?: (open: boolean) => void;
  /** What opens the dialog. Optional: most are opened by state set somewhere else. */
  trigger?: FloatingProps['trigger'];
  title: ReactNode;
  description?: ReactNode;
  /** Anything the question needs beyond the description, such as a field to type a name into. */
  children?: ReactNode;
  /**
   * The action the dialog asks about. Clicking it does not close the dialog: the caller owns
   * `open`, and closes once the work it kicks off has finished.
   */
  confirm: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'destructive';
    'data-cy'?: string;
  };
  /** The way out. Closes the dialog; `false` for a question with no way out but an answer. */
  cancel?: { label?: string; onClick?: () => void; disabled?: boolean; 'data-cy'?: string } | false;
  attrs?: Record<string, string>;
};

/**
 * A question with a confirm and a cancel. Unlike a Dialog it has no close button and does not
 * close on a backdrop click, so it can only be answered.
 */
export function AlertDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  trigger,
  title,
  description,
  children,
  confirm,
  cancel = {},
  attrs,
}: AlertDialogProps) {
  return (
    <BaseAlertDialog.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {trigger ? <BaseAlertDialog.Trigger render={trigger as ReactElement} /> : null}
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={backdropClass} />
        <BaseAlertDialog.Popup className={popupClass} {...attrs}>
          <OverlayHeader title={title} description={description} clearCloseButton={false} />
          {children != null ? (
            <OverlayBody padding="default" padBottom={false}>
              {children}
            </OverlayBody>
          ) : null}
          <OverlayFooter>
            {cancel !== false ? (
              <BaseAlertDialog.Close
                render={
                  <Button
                    variant="outline"
                    onClick={cancel.onClick}
                    disabled={cancel.disabled}
                    data-cy={cancel['data-cy']}
                  >
                    {cancel.label ?? 'Cancel'}
                  </Button>
                }
              />
            ) : null}
            <Button
              variant={confirm.variant ?? 'primary'}
              onClick={confirm.onClick}
              disabled={confirm.disabled}
              data-cy={confirm['data-cy']}
            >
              {confirm.label}
            </Button>
          </OverlayFooter>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
