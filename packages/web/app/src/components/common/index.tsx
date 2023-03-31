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
  py-1 px-2
  rounded
  bg-yellow-50 dark:bg-white/10
  text-yellow-600 dark:text-yellow-300
  text-xs font-medium tracking-widest`,
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
    <div className={clsx('flex flex-col relative h-full', className)}>
      <div className="p-4 shrink-0 flex flex-row justify-between items-center">
        <div>
          <h2 className="text-xl text-black dark:text-white font-bold">{title}</h2>
          <span className="text-sm text-gray-600 dark:text-gray-300 mt-2">{subtitle}</span>
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
    <h3 className={clsx('text-base text-black dark:text-white font-bold', className)} {...props}>
      {children}
    </h3>
  ),
  BigTitle: ({ className, children, ...props }: ComponentProps<'h2'>): ReactElement => (
    <h2 className={clsx('text-base text-black dark:text-white font-bold', className)} {...props}>
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
    <div className={clsx('flex flex-row space-x-1 grow-0', className)}>
      {new Array(size).fill(null).map((_, i) => (
        <div
          key={i}
          className={clsx('w-1 h-4', value >= i * (max / size) ? 'bg-emerald-400' : 'bg-gray-200')}
        />
      ))}
    </div>
  );
}
