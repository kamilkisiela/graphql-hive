import type { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { InfoCircledIcon } from '@radix-ui/react-icons';

const TypeToEmoji = {
  default: '💡',
  error: '🚫',
  info: <InfoCircledIcon className="h-6 w-auto" />,
  warning: '⚠️',
};

type CalloutType = keyof typeof TypeToEmoji;

const classes: Record<CalloutType, string> = {
  default: clsx(
    'border-orange-100 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-300',
  ),
  error: clsx(
    'border-red-200 bg-red-100 text-red-900 dark:border-red-200/30 dark:bg-red-900/30 dark:text-red-200',
  ),
  info: clsx(
    'border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-200/30 dark:bg-blue-900/30 dark:text-blue-200',
  ),
  warning: clsx(
    'border-yellow-100 bg-yellow-50 text-yellow-900 dark:border-yellow-200/30 dark:bg-yellow-700/30 dark:text-yellow-200',
  ),
};

type CalloutProps = {
  type?: CalloutType;
  emoji?: string | ReactElement;
  children: ReactNode;
  className?: string;
};

export function Callout({
  children,
  type = 'default',
  emoji = TypeToEmoji[type],
  className,
}: CalloutProps): ReactElement {
  return (
    <div
      className={clsx(
        'mt-6 flex items-center gap-4 rounded-lg border px-4 py-2',
        classes[type],
        className,
      )}
    >
      <div
        className="select-none text-xl"
        style={{
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        }}
      >
        {emoji}
      </div>
      <div className="w-full min-w-0 leading-7">{children}</div>
    </div>
  );
}
