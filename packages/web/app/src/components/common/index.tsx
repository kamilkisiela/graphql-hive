import { ComponentProps, ReactElement, ReactNode } from 'react';
import Head from 'next/head';
import { clsx } from 'clsx';

export const Title = ({ title }: { title: string }): ReactElement => (
  <Head>
    <title>{title} - GraphQL Hive</title>
    <meta property="og:title" content={`${title} - GraphQL Hive`} key="title" />
  </Head>
);

export function Label({ className, children, ...props }: ComponentProps<'span'>): ReactElement {
  return (
    <span
      className={clsx(
        `
  inline-block
  rounded bg-yellow-50
  px-2
  py-1 text-xs
  font-medium tracking-widest
  text-yellow-600 dark:bg-white/10 dark:text-yellow-300`,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export const Page = ({
  title,
  subtitle = '',
  scrollable = false,
  actions,
  children,
  noPadding,
  className,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactElement;
  scrollable?: boolean;
  noPadding?: boolean;
  className?: string;
}): ReactElement => {
  return (
    <div className={clsx('relative flex h-full flex-col', className)}>
      <div className="flex shrink-0 flex-row items-center justify-between p-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">{title}</h2>
          <span className="mt-2 text-sm text-gray-600 dark:text-gray-300">{subtitle}</span>
        </div>
        <div className="flex flex-row items-center space-x-2">{actions}</div>
      </div>
      {noPadding ? (
        children
      ) : (
        <div
          className={clsx(
            'px-4 pb-4 dark:text-white',
            scrollable ? 'grow overflow-y-auto' : 'h-full',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const Section = {
  Title: ({ className, children, ...props }: ComponentProps<'h3'>): ReactElement => (
    <h3 className={clsx('text-base font-bold text-black dark:text-white', className)} {...props}>
      {children}
    </h3>
  ),
  BigTitle: ({ className, children, ...props }: ComponentProps<'h2'>): ReactElement => (
    <h2 className={clsx('text-base font-bold text-black dark:text-white', className)} {...props}>
      {children}
    </h2>
  ),
  Subtitle: ({ className, children, ...props }: ComponentProps<'div'>): ReactElement => (
    <div className={clsx('text-sm text-gray-600 dark:text-gray-300', className)} {...props}>
      {children}
    </div>
  ),
};

export function Scale({
  value,
  max,
  size,
  className,
}: {
  value: number;
  max: number;
  size: number;
  className?: string;
}): ReactElement {
  return (
    <div className={clsx('flex grow-0 flex-row space-x-1', className)}>
      {new Array(size).fill(null).map((_, i) => (
        <div
          key={i}
          className={clsx('h-4 w-1', value >= i * (max / size) ? 'bg-emerald-400' : 'bg-gray-200')}
        />
      ))}
    </div>
  );
}
