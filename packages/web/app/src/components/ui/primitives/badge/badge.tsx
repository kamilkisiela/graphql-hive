import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '../floating/tooltip/tooltip';

const badgeVariants = cva(
  // Takes the cursor of a trigger it sits in.
  'inline-flex w-fit shrink-0 cursor-default in-[:is(a,button,[role=button])]:cursor-[inherit] items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border font-medium',
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
  /** Leads the text, in the text's colour. */
  icon?: LucideIcon;
  variants?: VariantProps<typeof badgeVariants>;
  // The sentence a short badge stands for.
  tooltip?: ReactNode;
};

export function Badge({ content, icon: Icon, variants, tooltip }: BadgeProps) {
  const badge = (
    <span className={badgeVariants({ ...variants })}>
      {Icon ? (
        <Icon aria-hidden className={variants?.size === 'sm' ? 'size-3' : 'size-3.5'} />
      ) : null}
      {content}
    </span>
  );
  return tooltip ? <Tooltip trigger={badge} content={tooltip} /> : badge;
}
