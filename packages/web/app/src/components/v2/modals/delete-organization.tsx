import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal } from '@/components/v2';
import { FragmentType, graphql } from '@/gql';
import { TrashIcon } from '@radix-ui/react-icons';
import { useRouter } from '@tanstack/react-router';

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
    id
    cleanId
  }
`);

export const DeleteOrganizationModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof DeleteOrganizationModal_OrganizationFragment>;
  organizationId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen } = props;
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const router = useRouter();

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
        <Button type="button" size="lg" className="w-full justify-center" onClick={toggleModalOpen}>
          Cancel
        </Button>
        <Button
          size="lg"
          className="w-full justify-center"
          variant="destructive"
          onClick={async () => {
            await mutate({
              selector: {
                organization: props.organizationId,
              },
            });
            void router.navigate({
              to: '/',
            });
            toggleModalOpen();
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
