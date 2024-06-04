import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks';
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

export function DeleteOperationModal(props: {
  close: () => void;
  operationId: string;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const { close, operationId } = props;
  const [, mutate] = useMutation(DeleteOperationMutation);
  const notify = useNotifications();

  return (
    <Modal open onOpenChange={close} className="flex flex-col items-center gap-5">
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete Operation</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this operation? This action is irreversible!
      </p>
      <div className="flex w-full gap-2">
        <Button type="button" size="lg" className="w-full justify-center" onClick={close}>
          Cancel
        </Button>
        <Button
          size="lg"
          className="w-full justify-center"
          variant="destructive"
          onClick={async () => {
            const { error } = await mutate({
              id: operationId,
              selector: {
                target: props.targetId,
                organization: props.organizationId,
                project: props.projectId,
              },
            });

            if (error) {
              notify(error.message, 'error');
            }
            close();
          }}
          data-cy="confirm"
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
