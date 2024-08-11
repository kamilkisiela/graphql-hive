import { useRouter } from '@tanstack/react-router';

export function useOperationFromQueryString() {
  const router = useRouter();

  const { search } = router.latestLocation;

  return 'operation' in search && typeof search.operation === 'string' ? search.operation : null;
}
