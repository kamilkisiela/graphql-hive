import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import { Button } from '@chakra-ui/react';
import { Card } from '@/components/common';
import { DeleteProjectDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Confirmation } from '@/components/common/Confirmation';

export const DeleteSettings: React.FC = () => {
  const router = useRouteSelector();
  const [result, mutate] = useMutation(DeleteProjectDocument);
  const [isOpen, setIsOpen] = React.useState(false);

  const deleteProject = React.useCallback(() => setIsOpen(true), [setIsOpen]);
  const onCancel = React.useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  const onConfirm = React.useCallback(() => {
    const selector = {
      organization: router.organizationId,
      project: router.projectId,
    };
    return mutate({
      selector,
    }).finally(() => {
      router.visitOrganization({
        organizationId: router.organizationId,
      });
    });
  }, [setIsOpen, router, mutate]);

  return (
    <>
      <Confirmation
        isOpen={isOpen}
        title="Delete project"
        description="Are you sure you wish to delete this project? This action is irreversible!"
        action="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
      <Card.Root>
        <Card.Title>Delete Project</Card.Title>
        <Card.Content>
          <p>Permanently remove your Project and all targets from the Organization.</p>
          <div tw="mt-3 flex flex-row items-center">
            <Button
              colorScheme="red"
              type="button"
              tw="mr-3"
              size="sm"
              disabled={result.fetching}
              onClick={deleteProject}
            >
              Delete Project
            </Button>
            <span tw="pl-2 font-bold text-sm">This action is not reversible</span>
          </div>
        </Card.Content>
      </Card.Root>
    </>
  );
};
