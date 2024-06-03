import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { TrashIcon } from '@radix-ui/react-icons';
import { useRouter } from '@tanstack/react-router';

export const DeleteTargetMutation = graphql(`
  mutation deleteTarget($selector: TargetSelectorInput!) {
    deleteTarget(selector: $selector) {
      selector {
        organization
        project
        target
      }
      deletedTarget {
        __typename
        id
      }
    }
  }
`);

export const DeleteTargetModal = ({
  isOpen,
  toggleModalOpen,
  organizationId,
  projectId,
  targetId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const [, mutate] = useMutation(DeleteTargetMutation);
  const router = useRouter();

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete target</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this target? This action is irreversible!
      </p>
      <div className="flex w-full gap-2">
        <Button className="w-full justify-center" type="button" size="lg" onClick={toggleModalOpen}>
          Cancel
        </Button>
        <Button
          className="w-full justify-center"
          size="lg"
          variant="destructive"
          onClick={async () => {
            await mutate({
              selector: {
                organization: organizationId,
                project: projectId,
                target: targetId,
              },
            });
            toggleModalOpen();
            void router.navigate({
              to: '/$organizationId/$projectId',
              params: {
                organizationId,
                projectId,
              },
            });
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
