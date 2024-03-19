import { ReactElement, ReactNode } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/v2';
import { cn } from '@/lib/utils';

export function OperationsFallback({
  children,
  state,
  refetch,
}: {
  children: ReactNode;
  state: 'fetching' | 'error' | 'empty' | 'success';
  refetch: () => void;
}): ReactElement {
  return (
    <div className="relative">
      <div
        className={cn(
          (state === 'error' || state === 'empty') && 'blur-sm',
          state === 'fetching' || state === 'empty' ? 'opacity-30' : 'opacity-100',
        )}
      >
        {children}
      </div>
      {state === 'empty' ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Alert className=" right-0 top-0 max-w-[500px]">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>No stats available yet.</AlertTitle>
            <AlertDescription>
              There is no information available for the selected date range.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button danger onClick={refetch}>
            Failed to load data. Click to retry.
          </Button>
        </div>
      ) : null}
    </div>
  );
}
