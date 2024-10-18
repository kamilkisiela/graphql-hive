import { useQuery } from 'urql';
import { graphql } from '@/gql';
import { useOperationFromQueryString } from './useOperationFromQueryString';

const OperationQuery = graphql(`
  query Operation($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
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

export function useCurrentOperation(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const operationIdFromSearch = useOperationFromQueryString();
  const [{ data }] = useQuery({
    query: OperationQuery,
    variables: {
      selector: {
        targetSlug: props.targetSlug,
        projectSlug: props.projectSlug,
        organizationSlug: props.organizationSlug,
      },
      id: operationIdFromSearch!,
    },
    pause: !operationIdFromSearch,
  });
  // if operationId is undefined `data` could contain previous state
  return operationIdFromSearch ? data?.target?.documentCollectionOperation : null;
}
