import { ReactElement, ReactNode } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/v2';

export function OperationsFallback({
  isError,
  isFetching,
  refetch,
  children,
}: {
  children: ReactNode;
  isError: boolean;
  isFetching?: boolean;
  refetch: () => void;
}): ReactElement {
  return (
    <div className="relative">
      <div className={clsx(isError && 'blur-sm', isFetching ? 'opacity-50' : 'opacity-100')}>
        {children}
      </div>
      {isError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button danger onClick={refetch}>
            Failed to load data. Click to retry.
          </Button>
        </div>
      ) : null}
    </div>
  );
}
