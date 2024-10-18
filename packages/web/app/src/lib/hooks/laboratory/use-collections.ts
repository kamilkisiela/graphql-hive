import { useEffect } from 'react';
import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { CollectionsQuery as _CollectionsQuery } from '@/gql/graphql';
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

export type DocumentCollectionOperation = Exclude<
  _CollectionsQuery['target'],
  null | undefined
>['documentCollections']['edges'][number]['node'];

const EMPTY_ARRAY: DocumentCollectionOperation[] = [];

export function useCollections(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): {
  fetching: boolean;
  collections: DocumentCollectionOperation[];
} {
  const [{ data, error, fetching }] = useQuery({
    query: CollectionsQuery,
    variables: {
      selector: {
        targetSlug: props.targetSlug,
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
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
    collections: data?.target?.documentCollections.edges.map(v => v.node) || EMPTY_ARRAY,
    fetching,
  };
}
