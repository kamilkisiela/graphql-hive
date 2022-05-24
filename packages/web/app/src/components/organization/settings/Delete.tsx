import { Button } from '@chakra-ui/react';
import { Card } from '@/components/common';
import { Confirmation } from '@/components/common/Confirmation';
import { DeleteOrganizationDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';

export const DeleteSettings: React.FC = () => {
  const router = useRouteSelector();
  const [result, mutate] = useMutation(DeleteOrganizationDocument);
  const [isOpen, setIsOpen] = React.useState(false);

  const deleteOrganization = React.useCallback(() => setIsOpen(true), [setIsOpen]);
  const onCancel = React.useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  const onConfirm = React.useCallback(() => {
    const selector = {
      organization: router.query.orgId as string,
    };
    mutate({
      selector,
    }).finally(() => {
      router.visitHome();
    });
  }, [setIsOpen, router, mutate]);

  return (
    <>
      <Confirmation
        isOpen={isOpen}
        title="Delete organization"
        description="Are you sure you wish to delete this organization? This action is irreversible!"
        action="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
      <Card.Root>
        <Card.Title>Delete Organization</Card.Title>
        <Card.Content>
          <p>Permanently remove your Organization and all projects from the Hive.</p>
          <div tw="mt-3 flex flex-row items-center">
            <Button
              colorScheme="red"
              type="button"
              tw="mr-3"
              size="sm"
              disabled={result.fetching}
              onClick={deleteOrganization}
            >
              Delete Organization
            </Button>
            <span tw="pl-2 font-bold text-sm">This action is not reversible</span>
          </div>
        </Card.Content>
      </Card.Root>
    </>
  );
};
