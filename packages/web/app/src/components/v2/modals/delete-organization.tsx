import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button, Heading, Modal } from '@/components/v2';
import { FragmentType, graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useRouter } from '@/lib/hooks/use-route-selector';
import { TrashIcon } from '@radix-ui/react-icons';

export const DeleteOrganizationDocument = graphql(`
  mutation deleteOrganization($selector: OrganizationSelectorInput!) {
    deleteOrganization(selector: $selector) {
      selector {
        organization
      }
      organization {
        __typename
        id
      }
    }
  }
`);

const DeleteOrganizationModal_OrganizationFragment = graphql(`
  fragment DeleteOrganizationModal_OrganizationFragment on Organization {
    cleanId
  }
`);

export const DeleteOrganizationModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof DeleteOrganizationModal_OrganizationFragment>;
}): ReactElement => {
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const router = useRouteSelector();
  const { replace } = useRouter();

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete organization</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this organization? This action is irreversible!
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
            void (await replace('/'));
            toggleModalOpen();
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
