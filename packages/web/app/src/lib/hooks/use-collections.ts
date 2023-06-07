import { useEffect } from 'react';
import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { TargetDocument } from '@/graphql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const CollectionsQuery = graphql(`
  query Collections($selector: TargetSelectorInput!) {
    target(selector: $selector) {
      id
      documentCollections {
        nodes {
          id
          name
          operations(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`);

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
    query: CollectionsQuery,
    variables: {
      selector: {
        target: router.targetId,
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    pause: !targetId,
  });

  const notify = useNotifications();

  useEffect(() => {
    if (error) {
      notify(error.message, 'error');
    }
  }, [error]);

  return {
    collections: data?.target?.documentCollections.nodes,
    loading: result.fetching || fetching,
  };
}
