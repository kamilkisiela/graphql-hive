import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 cursor-default items-center justify-center overflow-hidden whitespace-nowrap rounded-md border font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-neutral-6 text-fg-default',
        secondary: 'border-transparent bg-neutral-4 text-fg-default',
        outline: 'border-line font-normal text-fg-default',
        // The semantic states, tinted: a 10% fill of the token under its full-strength text, so
        // a pill never needs its own red or green.
        success: 'border-transparent bg-success-tint text-success-text',
        warning: 'border-transparent bg-warning-tint text-warning-text',
        critical: 'border-transparent bg-critical-tint text-critical-text',
        info: 'border-transparent bg-info-tint text-info-text',
      },
      size: {
        default: 'text-xs',
        /** For a count beside a tab label or a filter row. */
        sm: 'text-2xs',
      },
      padding: {
        default: '',
        /** For a badge inside running text, so wrapped lines don't touch. */
        tight: 'px-1 py-0',
      },
      /** For an identifier such as a permission key, rather than a word. */
      mono: {
        true: 'font-mono',
        false: '',
      },
    },
    // Padding lives here so `tight` never shares a span with a size's padding.
    compoundVariants: [
      { size: 'default', padding: 'default', class: 'px-2 py-0.5' },
      { size: 'sm', padding: 'default', class: 'px-1.5 py-px' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      padding: 'default',
      mono: false,
    },
  },
);

type BadgeProps = {
  content: string;
  variants?: VariantProps<typeof badgeVariants>;
};

export function Badge({ content, variants }: BadgeProps) {
  return <span className={badgeVariants({ ...variants })}>{content}</span>;
}
