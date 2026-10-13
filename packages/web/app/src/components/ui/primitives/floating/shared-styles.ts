/**
 * Shared style tokens for floating/overlay components (popover, menu, select, filter-dropdown, etc.)
 *
 * These are the common visual building blocks used across all floating
 * components. Centralizing them ensures visual consistency and makes it easy
 * to update the design system in one place.
 */
import { cva } from 'class-variance-authority';

/**
 * The inset of a panel made of menu rows: sides and bottom only, because the first row brings the
 * top inset itself (`first:mt-2`). A custom panel dropped into a Menu (`content` rather than
 * `sections`) gets no padding from the popup and applies this itself, so a search field can bleed
 * to the edges with `-mx-2` in either case.
 */
export const menuPanelInset = 'px-2 pb-2';

/** Base classes shared by all floating panels (menu, select, popover). */
export const floatingBaseClass =
  // No z-index here. The positioner is transformed for placement, which makes it a stacking
  // context, so a z-index on the popup would only compete inside it and lose to any page
  // element that outranks the positioner. It goes on the positioner instead.
  'text-control rounded-md border shadow-md shadow-neutral-1/30 outline-none bg-surface-floating border-line max-h-[var(--available-height)] overflow-y-auto overflow-x-hidden thin-scrollbar';

export const floatingVariants = cva(floatingBaseClass, {
  variants: {
    padding: {
      none: '',
      sm: 'px-1 py-1',
      md: 'px-2 py-2',
      menu: menuPanelInset,
    },
    maxWidth: {
      default: 'max-w-75',
      none: 'max-w-none',
      sm: 'max-w-60',
      lg: 'max-w-[380px]',
    },
    minWidth: {
      default: 'min-w-[12rem]',
      none: 'min-w-0',
      sm: 'min-w-40',
      md: 'min-w-60',
    },
    /**
     * A fixed width, for panels that should not resize with their content. `minWidth`/`maxWidth`
     * are the usual choice; reach for this only when every state of the panel wants one width,
     * as the row-action menus in the settings tables do.
     */
    width: {
      none: '',
      sm: 'w-40',
    },
  },
  defaultVariants: {
    padding: 'sm',
    maxWidth: 'none',
    minWidth: 'none',
    width: 'none',
  },
});

export const itemVariants = cva(
  'flex h-7 cursor-pointer select-none items-center rounded-sm outline-none gap-2',
  {
    variants: {
      variant: {
        default: 'px-2 text-fg-default',
        navigationLink: 'hover:text-accent text-accent-muted justify-end pr-2 hover:bg-transparent',
        action: 'pl-2 hover:bg-accent-tint hover:text-accent text-accent-muted',
        destructiveAction: 'pl-2 text-critical hover:bg-critical-tint',
      },
      highlighted: {
        true: 'bg-surface-selected text-fg',
        false: '',
      },
      selected: {
        true: 'text-fg',
        false: '',
      },
      disabled: {
        true: 'pointer-events-none opacity-50',
        false: '',
      },
    },
    compoundVariants: [{ highlighted: true, className: 'bg-surface-selected text-fg' }],
    defaultVariants: {
      variant: 'default',
      highlighted: false,
      selected: false,
      disabled: false,
    },
  },
);

/** Common props shared by all floating components (popover, menu, select). */
export type FloatingProps = {
  /**
   * Element that triggers the floating panel.
   *
   * A function when the trigger has to be composed with a wrapper that owns the same element
   * and does not forward unknown props; passed as an element, such a wrapper would swallow the
   * trigger props and the panel would never open. Given a function you apply the props yourself:
   *
   * ```tsx
   * trigger={props => (
   *   <SomeTooltip label={label}>
   *     <Button {...props} />
   *   </SomeTooltip>
   * )}
   * ```
   */
  // `any` on the params because this has to satisfy every Base UI trigger, and each one has its
  // own props and state types that the package does not export a subpath for.
  trigger: React.ReactElement | ((props: any, state: any) => React.ReactElement);
  /** Which side of the trigger to position on */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment along the side */
  align?: 'start' | 'center' | 'end';
  /** Gap between trigger and popup in px */
  sideOffset?: number;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
};

/** Scrollbar styling for lists inside floating panels. */
export { scrollArea as floatingScrollArea } from '../shared-styles';

/** Empty state text inside a floating panel. */
export const floatingEmptyState = 'text-fg-subtle px-2 py-4 text-center text-sm italic';
