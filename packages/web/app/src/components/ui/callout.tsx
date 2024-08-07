import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { InfoCircledIcon } from '@radix-ui/react-icons';

const calloutVariants = cva('mt-6 flex items-center gap-4 rounded-lg border px-4 py-2', {
  variants: {
    type: {
      default:
        'border-orange-100 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-300',
      error:
        'border-red-200 bg-red-100 text-red-900 dark:border-red-200/30 dark:bg-red-900/30 dark:text-red-200',
      info: 'border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-200/30 dark:bg-blue-900/30 dark:text-blue-200',
      warning:
        'border-yellow-100 bg-yellow-50 text-yellow-900 dark:border-yellow-200/30 dark:bg-yellow-700/30 dark:text-yellow-200',
    },
  },
  defaultVariants: {
    type: 'default',
  },
});

const emojiMap = {
  default: '💡',
  error: '🚫',
  info: <InfoCircledIcon className="h-6 w-auto" />,
  warning: '⚠️',
};

type CalloutType = keyof typeof emojiMap;

type CalloutProps = {
  type?: CalloutType;
  emoji?: string | React.ReactElement;
  children: React.ReactNode;
  className?: string;
};

const Callout = React.forwardRef<
  HTMLDivElement,
  CalloutProps & VariantProps<typeof calloutVariants>
>(({ children, type = 'default', emoji, className, ...props }, ref) => {
  const selectedEmoji = emoji ?? emojiMap[type];

  return (
    <div ref={ref} className={cn(calloutVariants({ type }), className)} {...props}>
      <div
        className="select-none text-xl"
        style={{
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        }}
      >
        {selectedEmoji}
      </div>
      <div className="w-full min-w-0 leading-7">{children}</div>
    </div>
  );
});

Callout.displayName = 'Callout';

export { Callout };
