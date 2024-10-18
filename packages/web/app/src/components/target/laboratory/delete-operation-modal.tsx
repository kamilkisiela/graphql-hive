import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';

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
  isOpen: boolean;
  toggleModalOpen: () => void;
  operationId: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const { toast } = useToast();
  const { isOpen, toggleModalOpen, operationId } = props;
  const [, mutate] = useMutation(DeleteOperationMutation);

  const handleDelete = async () => {
    const { error } = await mutate({
      id: operationId,
      selector: {
        targetSlug: props.targetSlug,
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
      },
    });
    toggleModalOpen();
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Operation Deleted',
        description: 'The operation has been successfully deleted.',
        variant: 'default',
      });
    }
  };

  return (
    <DeleteOperationModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      handleDelete={handleDelete}
    />
  );
}

export function DeleteOperationModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  handleDelete: () => void;
}): ReactElement {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-4/5 max-w-[520px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete Operation</DialogTitle>
          <DialogDescription>Do you really want to delete this operation?</DialogDescription>
          <DialogDescription>
            <span className="font-bold">This action is irreversible!</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={ev => {
              ev.preventDefault();
              props.toggleModalOpen();
            }}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={props.handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
