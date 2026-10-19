import React from 'react';
import { CircleXIcon, InfoIcon, TriangleAlertIcon, ZapIcon } from 'lucide-react';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import * as styles from './callout.css';

const TypeToEmoji = {
  default: <ZapIcon className={styles.zapIcon} />,
  error: <CircleXIcon className={styles.circleXIcon} />,
  info: <InfoIcon className={styles.infoIcon} />,
  warning: <TriangleAlertIcon className={styles.triangleAlertIcon} />,
};

type CalloutType = keyof typeof TypeToEmoji;

const calloutVariants = lenient(styles.calloutVariants);

type CalloutProps = {
  type?: CalloutType;
  emoji?: string | React.ReactElement;
  children: React.ReactNode;
  className?: string;
};

const Callout = React.forwardRef<
  HTMLDivElement,
  CalloutProps & NonNullable<Parameters<typeof calloutVariants>[0]>
>(({ children, type = 'default', emoji = TypeToEmoji[type], className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn(calloutVariants({ type }), className)} {...props}>
      <div
        className={styles.div}
        style={{
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        }}
      >
        {emoji}
      </div>
      <div>{children}</div>
    </div>
  );
});

Callout.displayName = 'Callout';

export { Callout };
