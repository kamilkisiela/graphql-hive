import { forwardRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRender } from '@base-ui/react/use-render';
import {
  controlOnSurface,
  controlSize,
  disabledStyle,
  focusRing,
  segmentSeparator,
} from '../shared-styles';

export const buttonVariants = cva(
  [
    'group inline-flex items-center rounded-sm border font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    focusRing,
  ],
  {
    variants: {
      variant: {
        // Segmented trigger style (for selects, menus, popovers, filters). Fill and border come
        // from `controlOnSurface` in the compound variants below.
        default: 'text-fg-muted hover:text-fg-default dark:text-fg-default',
        active: ['border-line dark:border-line-strong text-fg', 'bg-neutral-3 dark:bg-neutral-5'],
        action: [
          'border-dashed border-accent-line text-accent-muted bg-accent-tint-subtle',
          'hover:border-accent-muted hover:text-accent hover:bg-accent-tint',
        ],
        'muted-action': ['border-dashed hover:bg-neutral-3 hover:border-neutral-7 hover:text-fg'],
        // Standard button styles (for form actions)
        primary: 'bg-surface-inverse text-fg-inverse hover:bg-neutral-11 border-transparent',
        outline: 'border-line bg-transparent text-fg-default hover:bg-neutral-4 hover:text-fg',
        ghost: 'border-transparent bg-transparent text-fg-secondary hover:text-fg',
        destructive: [
          'bg-critical-tint-subtle border-critical-line text-critical-text hover:bg-critical-tint hover:border-critical',
        ],
        // Text that acts: accent, underlined on hover, no box. Sits inline with the copy around it.
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        compact: controlSize.compact,
        default: controlSize.default,
        'icon-sm': 'size-7 justify-center',
      },
      // What is inside. `label` and `iconOnly` pad their own segments, so the separators between
      // segments can run the full height; only `children` pads the button itself, by size.
      // `iconOnly` is a square: its width is the size's height, set in the compound variants.
      layout: {
        children: '',
        label: '',
        iconOnly: 'justify-center',
      },
      // Only `full` exists because only full-width is a thing buttons ask for: 116 of the
      // legacy call sites set w-full and nothing else. Fixed widths belong to the component
      // that needs them (a Select trigger), which sizes its wrapper and passes `full` down.
      width: {
        auto: '',
        full: 'w-full',
      },
      // Which surface the button sits on. Only `default` changes: it is the one variant with a
      // fill of its own to drop, and it is the variant Select uses for its trigger.
      onSurface: {
        base: '',
        raised: '',
      },
    },
    compoundVariants: [
      { variant: 'default', onSurface: 'base', class: controlOnSurface.base },
      { variant: 'default', onSurface: 'raised', class: controlOnSurface.raised },
      { layout: 'children', size: 'compact', class: 'gap-1 px-3' },
      { layout: 'children', size: 'default', class: 'gap-1.5 px-4' },
      { layout: 'iconOnly', size: 'compact', class: 'w-7.5' },
      { layout: 'iconOnly', size: 'default', class: 'w-9' },
      // A plain button centres its content when stretched; a segmented one keeps the label at the
      // leading edge and its icon at the trailing edge (the label segment grows to push it there).
      { layout: 'children', width: 'full', class: 'justify-center' },
      // Last, so it wins over the size and padding above once the classes are merged.
      { variant: 'link', class: 'h-auto rounded-none border-0 bg-transparent p-0' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      layout: 'children',
      width: 'auto',
      onSurface: 'base',
    },
  },
);

type AnchorProps = {
  href: string;
  target?: '_blank' | '_self';
  rel?: string;
  download?: boolean | string;
};

// `layout` is a cva variant so padding can key on it, but as a prop it is the discriminant of
// the union below, so the union defines it rather than cva.
type CommonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'> &
  Omit<VariantProps<typeof buttonVariants>, 'layout'> & {
    'data-cy'?: string;
    /**
     * Render an `<a>` instead of a `<button>`, for a button that links out: another site, a
     * mailto, an API redirect. A `_blank` target gets `rel="noopener noreferrer"` unless `rel`
     * is given, and `disabled` becomes `aria-disabled` with the href dropped. Router links use
     * `render` with `<Link>` instead.
     */
    anchor?: AnchorProps;
    /**
     * The element to render instead of a `<button>`, for a button that navigates within the
     * app: a router `<Link>`. It gets the button's classes, ref and handlers merged onto its own.
     */
    render?: useRender.RenderProp;
  };

/** Simple button with children content */
type ChildrenLayout = CommonProps & {
  children: ReactNode;
  label?: never;
  rightIcon?: never;
  accessoryInformation?: never;
  layout?: never;
  icon?: never;
};

/** Segmented button with label and optional right icon with separator */
type LabelLayout = CommonProps & {
  children?: never;
  /**
   * Button label content (always shown).
   * Accepts a string for static labels, or a ReactNode for dynamic content
   * (e.g. `<BaseSelect.Value />` when used as a Select trigger).
   */
  label: ReactNode;
  /** Icon rendered to the right of label */
  rightIcon?: {
    action?: () => void;
    icon: LucideIcon;
    label?: string;
    withSeparator: boolean;
  };
  /** Accessory information displayed after the label and before any actions */
  accessoryInformation?: string;
  layout?: 'label';
  icon?: never;
};

/** Icon-only button */
type IconOnlyLayout = CommonProps & {
  children?: never;
  label?: never;
  rightIcon?: never;
  accessoryInformation?: never;
  layout: 'iconOnly';
  icon: LucideIcon;
  'aria-label': string;
};

type ButtonProps = ChildrenLayout | LabelLayout | IconOnlyLayout;

/**
 * forwardRef is needed because Base UI Select/Menu use `render` prop
 * which passes a ref to the trigger element.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const { variant, size, width, onSurface, disabled, anchor, render, ...rest } = props;

  // Remove custom props so they don't get spread onto the DOM element
  const domProps = rest as Record<string, unknown>;
  delete domProps.layout;
  delete domProps.label;
  delete domProps.rightIcon;
  delete domProps.accessoryInformation;
  delete domProps.icon;
  delete domProps.children;

  const layout =
    props.layout === 'iconOnly' ? 'iconOnly' : props.label != null ? 'label' : 'children';

  const anchorElement = anchor ? (
    // eslint-disable-next-line jsx-a11y/anchor-has-content -- the render hook merges the button's children into it
    <a
      href={disabled ? undefined : anchor.href}
      target={anchor.target}
      rel={anchor.rel ?? (anchor.target === '_blank' ? 'noopener noreferrer' : undefined)}
      download={anchor.download}
    />
  ) : undefined;

  return useRender({
    render: anchorElement ?? render,
    ref,
    defaultTagName: 'button',
    props: {
      className: cn(buttonVariants({ variant, size, layout, width, onSurface })),
      disabled: anchor ? undefined : disabled,
      'aria-disabled': anchor && disabled ? true : undefined,
      tabIndex: anchor && disabled ? -1 : undefined,
      style: disabled ? disabledStyle : undefined,
      ...domProps,
      children:
        props.layout === 'iconOnly' ? (
          <span className="flex items-center p-1.5">
            <props.icon className="size-4" />
          </span>
        ) : props.label != null ? (
          <>
            <span className="flex grow items-center self-stretch px-3">{props.label}</span>

            {props.accessoryInformation != null && (
              <span className={`${segmentSeparator} flex items-center self-stretch px-3`}>
                {props.accessoryInformation}
              </span>
            )}
            {props.rightIcon && (
              <span
                role={props.rightIcon.action ? 'button' : undefined}
                tabIndex={props.rightIcon.action ? 0 : undefined}
                aria-label={props.rightIcon.label ?? undefined}
                onPointerDown={
                  props.rightIcon.action
                    ? e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }
                    : undefined
                }
                onClick={
                  props.rightIcon.action
                    ? e => {
                        e.stopPropagation();
                        props.rightIcon!.action!();
                      }
                    : undefined
                }
                onKeyDown={
                  props.rightIcon.action
                    ? e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          props.rightIcon!.action!();
                        }
                      }
                    : undefined
                }
                className={`${props.rightIcon.withSeparator && segmentSeparator} text-fg-subtle ${props.rightIcon.action ? 'hover:text-fg-default' : 'group-hover:text-fg'} flex items-center self-stretch px-2`}
              >
                <props.rightIcon.icon className="size-3" />
              </span>
            )}
          </>
        ) : (
          props.children
        ),
    },
  });
});
