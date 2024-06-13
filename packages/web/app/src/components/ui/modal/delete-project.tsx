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

export const DeleteProjectMutation = graphql(`
  mutation deleteProject($selector: ProjectSelectorInput!) {
    deleteProject(selector: $selector) {
      selector {
        organization
        project
      }
      deletedProject {
        __typename
        id
      }
    }
  }
`);

export const DeleteProjectModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen, organizationId, projectId } = props;
  const [, mutate] = useMutation(DeleteProjectMutation);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organization: organizationId,
        project: projectId,
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete project',
        description: error.message,
      });
    } else {
      toast({
        title: 'Project deleted',
        description: 'The project has been successfully deleted.',
      });
      toggleModalOpen();
      void router.navigate({
        to: '/$organizationId',
        params: {
          organizationId,
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="flex flex-col items-center gap-5">
        <DialogHeader>
          <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
          <DialogTitle>Delete project</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you wish to delete this project? This action is irreversible!
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
