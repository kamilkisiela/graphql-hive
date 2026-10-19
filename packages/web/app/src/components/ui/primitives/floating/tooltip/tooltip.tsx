import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { useFloatingPortalContainer } from '../floating-portal-container';
import { type FloatingProps } from '../shared-styles';
import * as styles from './tooltip.css';

const TOOLTIP_DELAY = 300;

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider delay={TOOLTIP_DELAY}>{children}</BaseTooltip.Provider>;
}

const popupClass = styles.popupClass;

const maxWidthClass = {
  default: styles.maxWidthClassDefault,
  md: styles.maxWidthClassMd,
  lg: styles.maxWidthClassLg,
  screen: styles.maxWidthClassScreen,
} as const;

const paddingClass = {
  default: styles.paddingClassDefault,
  /** For a paragraph rather than a label. */
  lg: styles.paddingClassLg,
} as const;

type TooltipProps = Omit<FloatingProps, 'trigger'> & {
  /**
   * The element the hint belongs to. A string or number is wrapped in a focusable span so
   * keyboard users can reach it; an element is used as-is, so pass something focusable when the
   * hint matters.
   */
  trigger: ReactElement | string | number;
  /** What the tooltip says. Keep it to a sentence or two. */
  content: ReactNode;
  maxWidth?: keyof typeof maxWidthClass;
  padding?: keyof typeof paddingClass;
  /**
   * Turns the tooltip off without removing it from the tree, for a trigger whose explanation
   * only applies in some states.
   */
  disabled?: boolean;
  /** Point an arrow at the trigger. Off by default. */
  arrow?: boolean;
  defaultOpen?: boolean;
  /**
   * Close as soon as the pointer leaves the trigger instead of letting it travel into the popup.
   * For a tooltip over a row where the popup would cover the row beneath.
   */
  disableHoverablePopup?: boolean;
};

export function Tooltip({
  trigger,
  content,
  maxWidth = 'default',
  padding = 'default',
  disabled,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  arrow,
  open,
  defaultOpen,
  onOpenChange,
  disableHoverablePopup,
}: TooltipProps) {
  const portalContainer = useFloatingPortalContainer();
  const triggerElement = isValidElement(trigger) ? (
    trigger
  ) : (
    // The span exists to give a plain string a focus stop, so the hint is reachable by keyboard;
    // that is the one case where a tabIndex on a span is the point rather than a mistake.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <span tabIndex={0} className={styles.tooltipSpan}>
      {trigger}
    </span>
  );

  return (
    <BaseTooltip.Root
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? next => onOpenChange(next) : undefined}
      disableHoverablePopup={disableHoverablePopup}
    >
      <BaseTooltip.Trigger render={triggerElement} />
      <BaseTooltip.Portal container={portalContainer ?? undefined}>
        <BaseTooltip.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          // z-index goes here, not on the popup: the positioner is transformed for placement,
          // which makes it a stacking context that would trap a z-index set inside it.
          className={styles.tooltipPositioner}
        >
          <BaseTooltip.Popup
            className={cn(popupClass, maxWidthClass[maxWidth], paddingClass[padding])}
          >
            {arrow ? <BaseTooltip.Arrow className={styles.tooltipArrow} /> : null}
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
