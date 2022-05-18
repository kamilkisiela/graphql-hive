import React from 'react';
import 'twin.macro';
import { useMutation, useQuery } from 'urql';
import { Button, useDisclosure } from '@chakra-ui/react';
import { Confirmation } from '@/components/common/Confirmation';
import { DataWrapper } from '@/components/common/DataWrapper';
import { GraphQLHighlight } from '@/components/common/GraphQLSDLBlock';
import {
  DeletePersistedOperationDocument,
  OrganizationFieldsFragment,
  PersistedOperationDocument,
  ProjectAccessScope,
  ProjectFieldsFragment,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useProjectAccess } from '@/lib/access/project';

export const Viewer: React.FC<{
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
  operation: string;
}> = ({ project, organization, operation }) => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: PersistedOperationDocument,
    variables: {
      organizationId: router.organizationId,
      projectId: project.cleanId,
      operationId: operation,
    },
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const canDelete = useProjectAccess({
    scope: ProjectAccessScope.OperationsStoreWrite,
    member: organization.me,
    redirect: false,
  });
  const [result, mutate] = useMutation(DeletePersistedOperationDocument);
  const onDelete = React.useCallback(() => {
    mutate({
      input: {
        operation: query.data.persistedOperation.operationHash,
        organization: router.organizationId,
        project: router.projectId,
      },
    }).finally(() => {
      router.update({
        operation: undefined,
      });
    });
  }, [router, mutate]);

  return (
    <DataWrapper query={query}>
      {() => {
        const { content } = query.data.persistedOperation;

        return (
          <div tw="relative">
            <GraphQLHighlight code={content} light />
            {canDelete && (
              <>
                <Confirmation
                  isOpen={isOpen}
                  title="Delete operation"
                  description="Are you sure you wish to delete this project? This action is irreversible!"
                  action="Delete"
                  onConfirm={onDelete}
                  onCancel={onClose}
                />
                <Button
                  colorScheme="red"
                  size="sm"
                  type="button"
                  tw="absolute top-0 right-0"
                  disabled={result.fetching}
                  onClick={onOpen}
                >
                  Delete Operation
                </Button>
              </>
            )}
          </div>
        );
      }}
    </DataWrapper>
  );
};
