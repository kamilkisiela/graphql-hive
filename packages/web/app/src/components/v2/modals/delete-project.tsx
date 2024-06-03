import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal } from '@/components/v2';
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
  const { isOpen, toggleModalOpen } = props;
  const [, mutate] = useMutation(DeleteProjectMutation);
  const router = useRouter();

  return (
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="flex flex-col items-center gap-5"
    >
      <TrashIcon className="h-16 w-auto text-red-500 opacity-70" />
      <Heading>Delete project</Heading>
      <p className="text-sm text-gray-500">
        Are you sure you wish to delete this project? This action is irreversible!
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
              selector: {
                organization: props.organizationId,
                project: props.projectId,
              },
            });
            toggleModalOpen();
            void router.navigate({
              to: `/${props.organizationId}`,
              params: {
                organizationId: props.organizationId,
              },
            });
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
};
