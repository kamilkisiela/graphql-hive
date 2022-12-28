import React from 'react';
import { Progress } from '@chakra-ui/react';
import { useInflightRequests } from '@/lib/urql-exchanges/state';

export const LoadingAPIIndicator = React.memo(() => {
  const inflightRequests = useInflightRequests();
  const isFetching = inflightRequests > 0;

  return React.useMemo(() => {
    return isFetching ? (
      <Progress
        zIndex={10_000}
        position="fixed"
        top="0px"
        left="0px"
        isIndeterminate
        width="100vw"
        height="5px"
        colorScheme="yellow"
      />
    ) : null;
  }, [isFetching]);
});
