import { useEffect } from 'react';
import { useQuery } from 'urql';
import { CollectionsDocument, TargetDocument } from '@/graphql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export function useCollections() {
  const router = useRouteSelector();
  const [result] = useQuery({
    query: TargetDocument,
    variables: {
      targetId: router.targetId,
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
  });
  const targetId = result.data?.target?.id as string;

  const [{ data, error, fetching }] = useQuery({
    query: CollectionsDocument,
    variables: { targetId },
    pause: !targetId,
  });

  const notify = useNotifications();

  useEffect(() => {
    if (error) {
      notify(error.message, 'error');
    }
  }, [error]);

  return {
    collections: data?.collections.nodes,
    loading: result.fetching || fetching,
  };
}
