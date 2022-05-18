import { ReactElement, ReactNode } from 'react';
import clsx from 'clsx';

export const Badge = ({
  children,
  color = 'gray',
  ...props
}: {
  children?: ReactNode;
  color?: 'red' | 'yellow' | 'green' | 'gray' | 'orange';
}): ReactElement => {
  return (
    <span
      className={clsx(
        `
        inline-block
        rounded-full
        border-[3px] p-[3px]
        align-middle
        text-xs font-bold leading-none text-white
        `,
        {
          red: 'border-red-900 bg-red-500',
          yellow: 'border-yellow-900 bg-yellow-500',
          green: 'border-green-900 bg-green-500',
          gray: 'border-gray-900 bg-gray-500',
          orange: 'bg-orange-500 border-orange-900',
          // TODO: add variants and uncomment https://javisperez.github.io/tailwindcolorshades/?jumbo=7f818c&alizarin-crimson=ed2e39
          // cyan: 'bg-cyan-500 border-cyan-900',
          // purple: 'border-purple-900 bg-purple-500',
          // blue: 'border-blue-900 bg-blue-500',
          // magenta: 'bg-magenta-500 border-magenta-900',
        }[color]
      )}
      {...props}
    >
      {children}
    </span>
  );
};
