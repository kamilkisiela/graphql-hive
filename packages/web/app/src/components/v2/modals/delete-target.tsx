import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from 'urql';

import { Button, Heading, Modal } from '@/components/v2';
import { TrashIcon } from '@/components/v2/icon';
import { DeleteTargetDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

export const DeleteTargetModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const [, mutate] = useMutation(DeleteTargetDocument);
  const router = useRouteSelector();
  const { replace } = useRouter();

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-24 w-24 text-red-500 opacity-70" />
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
                organization: router.organizationId,
                project: router.projectId,
                target: router.targetId,
              },
            });
            toggleModalOpen();
            void replace(`/${router.organizationId}/${router.projectId}`);
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
