import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button, Heading, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useNotifications, useRouteSelector } from '@/lib/hooks';
import { TrashIcon } from '@radix-ui/react-icons';

const DeleteOperationMutation = graphql(`
  mutation DeleteOperation($selector: TargetSelectorInput!, $id: ID!) {
    deleteOperationInDocumentCollection(selector: $selector, id: $id) {
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
                operations {
                  edges {
                    node {
                      id
                    }
                    cursor
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

export type DeleteOperationMutationType = typeof DeleteOperationMutation;

export function DeleteOperationModal({
  isOpen,
  toggleModalOpen,
  operationId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  operationId: string;
}): ReactElement {
  const route = useRouteSelector();
  const [, mutate] = useMutation(DeleteOperationMutation);
  const notify = useNotifications();
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
            const { error } = await mutate({
              id: operationId,
              selector: {
                target: route.targetId,
                organization: route.organizationId,
                project: route.projectId,
              },
            });

            if (error) {
              notify(error.message, 'error');
            }
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
