import { Button } from '@chakra-ui/react';
import { Card } from '@/components/common';
import { Confirmation } from '@/components/common/Confirmation';
import { DeleteTargetDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';

export const DeleteSettings: React.FC = () => {
  const router = useRouteSelector();
  const [result, mutate] = useMutation(DeleteTargetDocument);
  const [isOpen, setIsOpen] = React.useState(false);

  const deleteTarget = React.useCallback(() => setIsOpen(true), [setIsOpen]);
  const onCancel = React.useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  const onConfirm = React.useCallback(() => {
    const selector = {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
    };
    mutate({
      selector,
    }).finally(() => {
      router.visitProject({
        organizationId: router.organizationId,
        projectId: router.projectId,
      });
    });
  }, [setIsOpen, router, mutate]);

  return (
    <>
      <Confirmation
        isOpen={isOpen}
        title="Delete target"
        description="Are you sure you wish to delete this target? This action is irreversible!"
        action="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
      <Card.Root>
        <Card.Title>Delete Target</Card.Title>
        <Card.Content>
          <p>Permanently remove your Target.</p>
          <div tw="mt-3 flex flex-row items-center">
            <Button
              colorScheme="red"
              disabled={result.fetching}
              onClick={deleteTarget}
              size="sm"
            >
              Delete Target
            </Button>
            <span tw="pl-2 font-bold text-sm">
              This action is not reversible
            </span>
          </div>
        </Card.Content>
      </Card.Root>
    </>
  );
};
