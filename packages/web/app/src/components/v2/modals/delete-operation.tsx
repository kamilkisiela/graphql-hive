import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button, Heading, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { TrashIcon } from '@radix-ui/react-icons';

const DeleteOperationMutation = graphql(`
  mutation DeleteOperation($id: ID!) {
    deleteOperationInDocumentCollection(id: $id)
  }
`);

export function DeleteOperationModal({
  isOpen,
  toggleModalOpen,
  operationId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  operationId: string;
}): ReactElement {
  const [, mutate] = useMutation(DeleteOperationMutation);

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete Operation</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this operation? This action is irreversible!
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
            await mutate({ id: operationId });
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
