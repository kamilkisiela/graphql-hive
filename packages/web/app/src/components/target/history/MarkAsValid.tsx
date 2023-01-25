import * as React from 'react';
import { useMutation } from 'urql';
import { Button } from '@/components/v2';
import { SchemaVersionFieldsFragment, UpdateSchemaVersionStatusDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';
import { Tooltip } from '@chakra-ui/react';

export const MarkAsValid: React.FC<{
  version: Pick<SchemaVersionFieldsFragment, 'id' | 'valid'>;
}> = ({ version }) => {
  const router = useRouteSelector();
  const [mutation, mutate] = useMutation(UpdateSchemaVersionStatusDocument);
  const markAsValid = React.useCallback(async () => {
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
    <Tooltip
      label="Enforce a valid state of the schema version. We don't recommend to change the status of your schema manually"
      fontSize="xs"
      placement="bottom-start"
    >
      <Button variant="link" disabled={mutation.fetching} onClick={markAsValid}>
        Mark as valid
      </Button>
    </Tooltip>
  );
};
