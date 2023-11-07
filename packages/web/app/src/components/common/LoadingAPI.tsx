import { memo } from 'react';
import { useInflightRequests } from '@/lib/urql-exchanges/state';

export const LoadingAPIIndicator = memo(() => {
  const inflightRequests = useInflightRequests();
  const isFetching = inflightRequests > 0;

  if (!isFetching) return null;

  return <div className="hive-loading-indicator fixed h-1.5 w-1/2 will-change-transform" />;
});
