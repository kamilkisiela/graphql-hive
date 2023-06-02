import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { graphql } from '@/gql';

export const DeleteChannelsButton_DeleteChannelsMutation = graphql(`
  mutation DeleteChannelsButton_DeleteChannelsMutation($input: DeleteAlertChannelsInput!) {
    deleteAlertChannels(input: $input) {
      ok {
        updatedProject {
          id
        }
      }
      error {
        message
      }
    }
  }
`);

export function DeleteChannelsButton({
  selected,
  onSuccess,
  organizationId,
  projectId,
}: {
  selected: string[];
  onSuccess(): void;
  organizationId: string;
  projectId: string;
}) {
  const [mutation, mutate] = useMutation(DeleteChannelsButton_DeleteChannelsMutation);

  return (
    <Button
      variant="destructive"
      disabled={selected.length === 0 || mutation.fetching}
      onClick={async () => {
        await mutate({
          input: {
            organization: organizationId,
            project: projectId,
            channels: selected,
          },
        });
        onSuccess();
      }}
    >
      Delete {selected.length || null}
    </Button>
  );
}
