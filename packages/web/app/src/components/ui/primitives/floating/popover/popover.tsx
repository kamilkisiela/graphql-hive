import { type ReactElement, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { useFloatingPortalContainer } from '../floating-portal-container';
import { floatingVariants, type FloatingProps } from '../shared-styles';
import * as styles from './popover.css';

// One scale for both modes. `sm` is what the legacy popover defaulted to; `lg` and `xl` round
// the two widest raw panels in the app (450 and 550px) to the rem grid.
const widthClass = {
  auto: '',
  sm: styles.widthClassSm,
  md: styles.widthClassMd,
  lg: styles.widthClassLg,
  xl: styles.widthClassXl,
} as const;

type PopoverCommonProps = Omit<FloatingProps, 'trigger'> & {
  /**
   * What opens the popover. Optional because a panel can be positioned against something that is
   * not its trigger (see `anchor`), or rendered only when there is something to show.
   */
  trigger?: FloatingProps['trigger'];
  /**
   * Position against this element instead of the trigger. For a panel that opens from a control
   * inside another panel but should sit beside the outer one.
   */
  anchor?: RefObject<Element | null> | Element | null;
  /** Show an arrow pointing to the trigger */
  arrow?: boolean;
  width?: keyof typeof widthClass;
  /** Keep the popup this far from the viewport edge when it has to shift, in px. */
  collisionPadding?: number;
  /**
   * Block interaction with the rest of the page while open. For a panel whose contents are a
   * task to finish, like a date range, rather than a glance.
   */
  modal?: boolean;
  /**
   * Move focus into the popup on open. Set false when the trigger is a text input whose value the
   * popup reacts to, so typing continues uninterrupted. Base UI's name for the same switch.
   */
  initialFocus?: boolean;
  /**
   * Also open on hover, after the same delay tooltips use. For an infotip: an icon whose only
   * job is to open the explanation. Hover keeps it discoverable, click keeps it reachable by
   * keyboard and touch.
   */
  openOnHover?: boolean;
};

/** Raw mode: full control over content */
type PopoverRawProps = PopoverCommonProps & {
  /** Content rendered directly inside the popup */
  content: ReactNode;
  /** `none` for content that lays itself out edge to edge, such as a list or a calendar. */
  padding?: 'none' | 'default';
  title?: never;
  description?: never;
  hideCloseButton?: never;
};

/** Structured mode: auto-renders header with title and close button */
type PopoverStructuredProps = PopoverCommonProps & {
  /** Title text shown in the header */
  title: string;
  /** Body content rendered below the header */
  content: ReactNode;
  /** Description text rendered between header and content */
  description?: ReactNode;
  /** Hide the close button in the header */
  hideCloseButton?: boolean;
  padding?: never;
};

export type PopoverProps = PopoverRawProps | PopoverStructuredProps;

function isStructured(props: PopoverProps): props is PopoverStructuredProps {
  return 'title' in props && props.title !== undefined;
}

export function Popover(props: PopoverProps) {
  const {
    trigger,
    anchor,
    side = 'bottom',
    align,
    sideOffset = 8,
    arrow,
    width,
    collisionPadding,
    modal,
    initialFocus = true,
    openOnHover,
    open,
    onOpenChange,
  } = props;
  const portalContainer = useFloatingPortalContainer();

  let inner: ReactNode;

  if (isStructured(props)) {
    inner = (
      <div className={cn(widthClass[width ?? 'md'], styles.popoverDiv)}>
        <div className={styles.popoverDiv2}>
          <span className={styles.popoverSpan}>{props.title}</span>
          {!props.hideCloseButton && (
            <BasePopover.Close className={styles.popoverClose} aria-label="Close">
              <X className={styles.popoverX} />
            </BasePopover.Close>
          )}
        </div>
        {props.description && <p className={styles.popoverP}>{props.description}</p>}
        {props.content}
      </div>
    );
  } else {
    inner = (
      <div
        className={cn(
          widthClass[width ?? 'sm'],
          props.padding === 'none' ? '' : styles.popoverDiv3,
        )}
      >
        {props.content}
      </div>
    );
  }

  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {trigger ? (
        <BasePopover.Trigger render={trigger as ReactElement} openOnHover={openOnHover} />
      ) : null}
      <BasePopover.Portal container={portalContainer ?? undefined}>
        <BasePopover.Positioner
          anchor={anchor}
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={styles.popoverPositioner}
        >
          <BasePopover.Popup
            className={floatingVariants({ padding: 'none' })}
            initialFocus={initialFocus ? undefined : false}
          >
            {arrow && <PopoverArrow />}
            {inner}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

function PopoverArrow() {
  return (
    <BasePopover.Arrow
      className={cn(
        'group',
        styles.popoverArrowArrow,
        styles.popoverArrowArrow2,
        styles.popoverArrowArrow3,
        styles.popoverArrowArrow4,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="8"
        fill="none"
        viewBox="0 0 20 8"
        className={cn(
          styles.popoverArrowSvg,
          styles.popoverArrowSvg2,
          styles.popoverArrowSvg3,
          styles.popoverArrowSvg4,
        )}
      >
        <path
          className={styles.popoverArrowPath}
          d="M9.664.602 4.808 4.973A4 4 0 0 1 2.132 6H0v2h20V6h-1.465a4 4 0 0 1-2.676-1.027L11.002.603a1 1 0 0 0-1.338 0"
        />
        <path
          className={styles.popoverArrowPath2}
          d="M10.333 1.345 5.477 5.716A5 5 0 0 1 2.132 7H0V6h2.132a4 4 0 0 0 2.676-1.027L9.664.603a1 1 0 0 1 1.338 0l4.857 4.37A4 4 0 0 0 18.535 6H20v1h-1.465a5 5 0 0 1-3.345-1.284z"
        />
      </svg>
    </BasePopover.Arrow>
  );
}
