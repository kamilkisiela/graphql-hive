import { ReactElement, useCallback } from 'react';
import { useMutation } from 'urql';
import { Button, Tooltip } from '@/components/v2';
import { SchemaVersionFieldsFragment, UpdateSchemaVersionStatusDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

export function MarkAsValid({
  version,
}: {
  version: Pick<SchemaVersionFieldsFragment, 'id' | 'valid'>;
}): ReactElement | null {
  const router = useRouteSelector();
  const [mutation, mutate] = useMutation(UpdateSchemaVersionStatusDocument);
  const markAsValid = useCallback(async () => {
    await mutate({
      input: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        version: version.id,
        valid: true,
      },
    });
  }, [mutate, version, router]);

  if (version?.valid) {
    return null;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip content="Enforce a valid state of the schema version. We don't recommend to change the status of your schema manually">
        <Button variant="link" disabled={mutation.fetching} onClick={markAsValid}>
          Mark as valid
        </Button>
      </Tooltip>
    </Tooltip.Provider>
  );
}
