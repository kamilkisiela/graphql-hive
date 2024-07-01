import { useRouter } from '@tanstack/react-router';
import { useQuery } from 'urql';
import { graphql } from '@/gql';

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
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const router = useRouter();
  const operationIdFromSearch =
    'operation' in router.latestLocation.search &&
    typeof router.latestLocation.search.operation === 'string'
      ? router.latestLocation.search.operation
      : null;
  const [{ data }] = useQuery({
    query: OperationQuery,
    variables: {
      selector: {
        target: props.targetId,
        project: props.projectId,
        organization: props.organizationId,
      },
      id: operationIdFromSearch!,
    },
    pause: !operationIdFromSearch,
  });
  // if operationId is undefined `data` could contain previous state
  return operationIdFromSearch ? data?.target?.documentCollectionOperation : null;
}
