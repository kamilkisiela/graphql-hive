import { PropsWithChildren } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/v2';

export const OperationsFallback = ({
  isError,
  isFetching,
  refetch,
  children,
}: PropsWithChildren<{ isError: boolean; isFetching?: boolean; refetch: () => void }>) => {
  return (
    <div className="relative">
      <div className={clsx(isError ? 'blur-sm	' : null, isFetching ? 'opacity-50' : 'opacity-100')}>
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
};
