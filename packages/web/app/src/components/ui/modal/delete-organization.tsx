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
import { FragmentType, graphql } from '@/gql';
import { TrashIcon } from '@radix-ui/react-icons';
import { useRouter } from '@tanstack/react-router';

export const DeleteOrganizationDocument = graphql(`
  mutation deleteOrganization($selector: OrganizationSelectorInput!) {
    deleteOrganization(selector: $selector) {
      selector {
        organization
      }
      organization {
        __typename
        id
      }
    }
  }
`);

const DeleteOrganizationModal_OrganizationFragment = graphql(`
  fragment DeleteOrganizationModal_OrganizationFragment on Organization {
    id
    cleanId
  }
`);

export const DeleteOrganizationModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof DeleteOrganizationModal_OrganizationFragment>;
  organizationId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen, organizationId } = props;
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organization: organizationId,
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete organization',
        description: error.message,
      });
    } else {
      toast({
        title: 'Organization deleted',
        description: 'The organization has been successfully deleted.',
      });
      toggleModalOpen();
      void router.navigate({
        to: '/',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="flex flex-col items-center gap-5">
        <DialogHeader>
          <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
          <DialogTitle>Delete organization</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you wish to delete this organization? This action is irreversible!
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
