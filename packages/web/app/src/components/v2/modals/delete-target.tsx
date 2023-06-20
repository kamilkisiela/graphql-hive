import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from 'urql';
import { Button, Heading, Modal } from '@/components/v2';
import { DeleteTargetDocument } from '@/graphql';
import { TrashIcon } from '@radix-ui/react-icons';

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
  const [, mutate] = useMutation(DeleteTargetDocument);
  const { replace } = useRouter();

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
                organization: organizationId,
                project: projectId,
                target: targetId,
              },
            });
            toggleModalOpen();
            void replace(`/${organizationId}/${projectId}`);
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
