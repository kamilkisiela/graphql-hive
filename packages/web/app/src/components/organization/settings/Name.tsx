import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import { Input, Button } from '@chakra-ui/react';
import { Card } from '@/components/common';
import {
  OrganizationFieldsFragment,
  UpdateOrganizationNameDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const NameSettings: React.FC<{
  organization: OrganizationFieldsFragment;
}> = ({ organization }) => {
  const router = useRouteSelector();
  const [name, setName] = React.useState<string>(organization.name);
  const [disabled, setDisabled] = React.useState(false);
  const [, mutate] = useMutation(UpdateOrganizationNameDocument);

  const submit = React.useCallback(() => {
    setDisabled(true);
    mutate({
      input: {
        organization: router.organizationId,
        name,
      },
    }).finally(() => {
      setDisabled(false);
    });
  }, [name, setDisabled, mutate, router]);

  return (
    <Card.Root>
      <Card.Title>Organization Name</Card.Title>
      <Card.Content>
        <p>Name of your organization visible within Hive.</p>
        <form tw="flex flex-row space-x-3 pt-3" onSubmit={submit}>
          <Input
            type="text"
            placeholder="Name your organization"
            disabled={disabled}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            colorScheme="primary"
            type="button"
            disabled={disabled || name.length === 0}
            onClick={submit}
          >
            Save
          </Button>
        </form>
      </Card.Content>
    </Card.Root>
  );
};
