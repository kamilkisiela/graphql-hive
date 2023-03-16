import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button, Heading, Modal } from '@/components/v2';
import { DeleteCollectionDocument } from '@/graphql';
import { TrashIcon } from '@radix-ui/react-icons';

export function DeleteCollectionModal({
  isOpen,
  toggleModalOpen,
  collectionId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  collectionId: string;
}): ReactElement {
  const [, mutate] = useMutation(DeleteCollectionDocument);

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete Collection</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this collection? This action is irreversible!
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
            await mutate({ id: collectionId });
            toggleModalOpen();
          }}
          data-cy="confirm"
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
