import React from 'react';
import 'twin.macro';
import { useQuery } from 'urql';
import { DataWrapper } from '@/components/common/DataWrapper';
import { PersistedOperations } from '@/components/project/persisted-operations/Operations';
import { Viewer } from '@/components/project/persisted-operations/Viewer';
import {
  OrganizationFieldsFragment,
  PersistedOperationsDocument,
  ProjectFieldsFragment,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { NoPersistedOperationsYet } from './NoPersistedOperationsYet';

export const Dashboard: React.FC<{
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ project, organization }) => {
  const router = useRouteSelector();

  const [query] = useQuery({
    query: PersistedOperationsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const [selectedOperation, setSelectedOperation] = React.useState(
    query.data?.persistedOperations.nodes?.[0]?.operationHash
  );

  React.useEffect(() => {
    if (router.query.operation) {
      setSelectedOperation(router.query.operation as string);
    }
  }, [router.query.operation, setSelectedOperation]);

  const selectOperation = React.useCallback(
    (operation) => router.update({ operation }),
    [router]
  );

  return (
    <DataWrapper query={query}>
      {() => {
        const persistedOperations = query.data.persistedOperations.nodes;

        if (!persistedOperations || !persistedOperations.length) {
          return <NoPersistedOperationsYet project={project.cleanId} />;
        }

        return (
          <div tw="flex flex-row h-full">
            <div tw="bg-white w-3/12 h-full overflow-x-auto divide-y divide-gray-200">
              <PersistedOperations
                persistedOperations={persistedOperations}
                onSelect={selectOperation}
                selected={selectedOperation}
              />
            </div>
            <div tw="w-9/12 overflow-y-auto">
              {selectedOperation && (
                <Viewer
                  project={project}
                  organization={organization}
                  operation={selectedOperation}
                />
              )}
            </div>
          </div>
        );
      }}
    </DataWrapper>
  );
};
