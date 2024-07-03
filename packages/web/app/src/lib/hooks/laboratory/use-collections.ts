import { useEffect } from 'react';
import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks';

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
            description
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

export function useCollections(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const [{ data, error, fetching }] = useQuery({
    query: CollectionsQuery,
    variables: {
      selector: {
        target: props.targetId,
        organization: props.organizationId,
        project: props.projectId,
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
    fetching,
  };
}
