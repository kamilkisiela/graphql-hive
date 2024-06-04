import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { TrashIcon } from '@radix-ui/react-icons';

const DeleteCollectionMutation = graphql(`
  mutation DeleteCollection($selector: TargetSelectorInput!, $id: ID!) {
    deleteDocumentCollection(selector: $selector, id: $id) {
      error {
        message
      }
      ok {
        deletedId
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`);

export type DeleteCollectionMutationType = typeof DeleteCollectionMutation;

export function DeleteCollectionModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  collectionId: string;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const { isOpen, toggleModalOpen, collectionId } = props;
  const [, mutate] = useMutation(DeleteCollectionMutation);

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
        <Button type="button" size="lg" className="w-full justify-center" onClick={toggleModalOpen}>
          Cancel
        </Button>
        <Button
          size="lg"
          className="w-full justify-center"
          variant="destructive"
          onClick={async () => {
            await mutate({
              id: collectionId,
              selector: {
                target: props.targetId,
                organization: props.organizationId,
                project: props.projectId,
              },
            });
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
