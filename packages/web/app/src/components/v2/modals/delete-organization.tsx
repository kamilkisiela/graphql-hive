import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery } from 'urql';

import { Button, Heading, Modal } from '@/components/v2';
import { TrashIcon } from '@/components/v2/icon';
import {
  DeleteOrganizationDocument,
  OrganizationsDocument,
  OrganizationType,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const DeleteOrganizationModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const router = useRouteSelector();
  const { replace } = useRouter();
  const [organizationsQuery] = useQuery({ query: OrganizationsDocument });
  const personalOrganization =
    organizationsQuery.data?.organizations.nodes.find(
      (node) => node.type === OrganizationType.Personal
    );

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-24 w-24 text-red-500 opacity-70" />
      <Heading>Delete organization</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this organization? This action is
        irreversible!
      </p>

      <div className="flex w-full gap-2">
        <Button type="button" size="large" block onClick={toggleModalOpen}>
          Cancel
        </Button>
        <Button
          size="large"
          block
          danger
          onClick={async () => {
            await mutate({
              selector: {
                organization: router.organizationId,
              },
            });
            toggleModalOpen();
            replace(`/${personalOrganization.cleanId}`);
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
