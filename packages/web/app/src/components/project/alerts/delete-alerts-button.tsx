import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import { graphql } from '@/gql';

export const DeleteAlertsButton_DeleteAlertsMutation = graphql(`
  mutation DeleteAlertsButton_DeleteAlertsMutation($input: DeleteAlertsInput!) {
    deleteAlerts(input: $input) {
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

export function DeleteAlertsButton({
  selected,
  onSuccess,
  organizationSlug,
  projectSlug,
}: {
  selected: string[];
  onSuccess(): void;
  organizationSlug: string;
  projectSlug: string;
}) {
  const [mutation, mutate] = useMutation(DeleteAlertsButton_DeleteAlertsMutation);

  return (
    <Button
      variant="destructive"
      disabled={selected.length === 0 || mutation.fetching}
      onClick={async () => {
        await mutate({
          input: {
            organizationSlug,
            projectSlug,
            alertIds: selected,
          },
        });
        onSuccess();
      }}
    >
      Delete {selected.length || null}
    </Button>
  );
}
