import { useEffect } from 'react';
import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const CollectionsQuery = graphql(`
  query Collections($selector: TargetSelectorInput!) {
    target(selector: $selector) {
      id
      documentCollections {
        edges {
          cursor
          node {
            id
            name
            operations(first: 100) {
              edges {
                node {
                  id
                  name
                }
                cursor
              }
            }
          }
        }
      }
    }
  }
`);

export function useCollections() {
  const router = useRouteSelector();
  const [{ data, error, fetching }] = useQuery({
    query: CollectionsQuery,
    variables: {
      selector: {
        target: router.targetId,
        organization: router.organizationId,
        project: router.projectId,
      },
    },
  });

  const notify = useNotifications();

  useEffect(() => {
    if (error) {
      notify(error.message, 'error');
    }
  }, [error]);

  return {
    collections: data?.target?.documentCollections.edges.map(v => v.node) || [],
    loading: fetching,
  };
}
