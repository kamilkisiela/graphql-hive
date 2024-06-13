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
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organization: organizationId,
        project: projectId,
        target: targetId,
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete target',
        description: error.message,
      });
    } else {
      toast({
        title: 'Target deleted',
        description: 'The target has been successfully deleted.',
      });
      toggleModalOpen();
      void router.navigate({
        to: '/$organizationId/$projectId',
        params: {
          organizationId,
          projectId,
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="flex flex-col items-center gap-5">
        <DialogHeader>
          <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
          <DialogTitle>Delete target</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you wish to delete this target? This action is irreversible!
        </DialogDescription>
        <DialogFooter className="flex w-full gap-2">
          <Button
            type="button"
            size="lg"
            onClick={toggleModalOpen}
            className="w-full justify-center"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={handleDelete}
            className="w-full justify-center"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
