import { Progress } from '@chakra-ui/react';
import { useMemo, memo } from 'react';
import { useInflightRequests } from '@/lib/urql-exchanges/state';

export const LoadingAPIIndicator = memo(() => {
  const inflightRequests = useInflightRequests();

  const isFetching = inflightRequests > 0;

  return useMemo(() => {
    if (isFetching) {
      return (
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
      );
    }

    return null;
  }, [isFetching]);
});
