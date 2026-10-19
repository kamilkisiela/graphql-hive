import { forwardRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  controlSize,
  controlSurface,
  focusRing,
  type ControlSize,
  type OnSurface,
} from '../shared-styles';
import * as styles from './input.css';

/** The field itself, shared with Textarea. Fill and border come from `fieldSurface`. */
export const fieldClass = [
  styles.fieldClass,
  // appearance-none: WebKit draws type="search" as a native searchfield with its own corners.
  styles.fieldClass2,
  focusRing,
  styles.fieldClass3,
  // Error state comes from the attribute, so a FormControl and a hand-set `invalid` prop paint the
  // same border.
  styles.fieldClass4,
];

/**
 * Fill and border by surface, at rest and focused. A raised field rests on the same fill as a
 * raised button (`controlSurface`) so an Input and a Select trigger match inside a dialog. Light
 * has no step above neutral-1, so a focused raised field there changes only its border and ring.
 */
export const fieldSurface = {
  base: [
    'bg-surface-control border-line-control focus:bg-neutral-1',
    'dark:focus:bg-neutral-4',
    'hover:border-line-strong focus:border-neutral-7',
  ].join(' '),
  raised: [
    controlSurface.raised,
    'dark:focus:bg-neutral-6',
    'hover:border-line-strong dark:hover:border-neutral-7 focus:border-neutral-7',
  ].join(' '),
} as const satisfies Record<OnSurface, string>;

// The block before a slug sits one step further from the page than the field it joins.
const prefixSurface = {
  base: 'border-line-control bg-neutral-3 dark:bg-neutral-4',
  raised: 'border-line bg-neutral-3 dark:bg-neutral-6 dark:border-line-strong',
} as const satisfies Record<OnSurface, string>;

export const fieldWidth = {
  full: 'w-full',
  xs: 'w-16',
  sm: 'w-48',
  md: 'w-96',
} as const;

const inputVariants = cva(fieldClass, {
  variants: {
    size: {
      compact: `${controlSize.compact} px-2.5 text-sm`,
      default: `${controlSize.default} px-3 text-sm`,
    },
    onSurface: fieldSurface,
    width: fieldWidth,
    mono: {
      true: 'font-mono text-xs',
      false: '',
    },
  },
  defaultVariants: {
    size: 'default',
    onSurface: 'base',
    width: 'full',
    mono: false,
  },
});

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'className' | 'style' | 'size' | 'width' | 'prefix'
>;

type InputProps = NativeInputProps &
  VariantProps<typeof inputVariants> & {
    /** Error state for a field outside a Form; FormControl sets `aria-invalid` itself. */
    invalid?: boolean;
    /** An icon inside the leading edge, for a search field. */
    leadingIcon?: LucideIcon;
    /** Something inside the trailing edge, such as an icon-only button. */
    trailing?: ReactNode;
    /** A fixed block attached to the leading edge, such as the base URL before a slug. */
    prefixText?: string;
    'data-cy'?: string;
  };

/** forwardRef is required: react-hook-form's Controller passes a ref to manage focus and validation. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size,
    onSurface,
    width,
    mono,
    invalid,
    leadingIcon: LeadingIcon,
    trailing,
    prefixText,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  // className is not a prop, but a spread from a form library can still carry one in; on the
  // element it would replace every class above, so it is dropped here rather than typed out.
  const { className: _injected, ...native } = props as typeof props & { className?: string };
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === 'true';
  const decorated = !!(LeadingIcon || trailing || prefixText);

  const input = (
    <input
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(
        inputVariants({ size, onSurface, width, mono }),
        LeadingIcon && styles.inputInput,
        trailing && styles.inputInput2,
        prefixText && styles.inputInput3,
      )}
      {...native}
    />
  );

  if (!decorated) {
    return input;
  }

  // The width stays on the field: a fixed field keeps its size and a prefix adds its own, so a
  // long slug prefix cannot squeeze the field. A fluid field needs the wrapper to be fluid too.
  return (
    <span className={cn(styles.inputSpan, (width ?? 'full') === 'full' && styles.inputSpan2)}>
      {prefixText ? (
        <span
          className={cn(
            controlSize[(size ?? 'default') as ControlSize],
            prefixSurface[onSurface ?? 'base'],
            styles.inputSpan3,
          )}
        >
          {prefixText}
        </span>
      ) : null}
      {LeadingIcon ? <LeadingIcon className={styles.inputLeadingIcon} /> : null}
      {input}
      {trailing ? <span className={styles.inputSpan4}>{trailing}</span> : null}
    </span>
  );
});
