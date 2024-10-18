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
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const { toast } = useToast();
  const { isOpen, toggleModalOpen, collectionId } = props;
  const [, mutate] = useMutation(DeleteCollectionMutation);

  const handleDelete = async () => {
    const { error } = await mutate({
      id: collectionId,
      selector: {
        targetSlug: props.targetSlug,
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
      },
    });
    toggleModalOpen();
    if (error) {
      toast({
        title: 'Failed to delete collection',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Collection deleted',
        description: 'The collection has been successfully deleted',
        variant: 'default',
      });
    }
  };

  return (
    <DeleteCollectionModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      handleDelete={handleDelete}
    />
  );
}

export function DeleteCollectionModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  handleDelete: () => void;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-4/5 max-w-[520px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete Collection</DialogTitle>
          <DialogDescription>Are you sure you wish to delete this collection?</DialogDescription>
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
