import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { useOperationFromQueryString } from './useOperationFromQueryString';

const OperationQuery = graphql(`
  query Operation($selector: TargetSelectorInput!, $id: ID!) {
    target(reference: { bySelector: $selector }) {
      id
      documentCollectionOperation(id: $id) {
        id
        name
        query
        headers
        variables
        updatedAt
        collection {
          id
          name
        }
      }
    }
  }
`);

export function useCurrentOperationWithFetchingState(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const operationIdFromSearch = useOperationFromQueryString();
  const [{ data, fetching }] = useQuery({
    query: OperationQuery,
    variables: {
      selector: {
        targetSlug: props.targetSlug,
        projectSlug: props.projectSlug,
        organizationSlug: props.organizationSlug,
      },
      id: operationIdFromSearch || '',
    },
    pause: !operationIdFromSearch,
    requestPolicy: 'network-only',
  });

  return {
    currentOperation: operationIdFromSearch ? data?.target?.documentCollectionOperation : null,
    fetching,
  };
}
