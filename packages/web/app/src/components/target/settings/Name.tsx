import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import { Input, Button } from '@chakra-ui/react';
import { Card } from '@/components/common';
import { TargetFieldsFragment, UpdateTargetNameDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const NameSettings: React.FC<{
  target: TargetFieldsFragment;
}> = ({ target }) => {
  const router = useRouteSelector();
  const [name, setName] = React.useState<string>(target.name);
  const [disabled, setDisabled] = React.useState(false);
  const [, mutate] = useMutation(UpdateTargetNameDocument);

  const submit = React.useCallback(() => {
    setDisabled(true);
    mutate({
      input: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        name,
      },
    }).finally(() => {
      setDisabled(false);
    });
  }, [name, setDisabled, mutate, router]);

  return (
    <Card.Root>
      <Card.Title>Target Name</Card.Title>
      <Card.Content>
        <p>Name of your target visible within organization.</p>
        <form tw="flex flex-row space-x-3 pt-3" onSubmit={submit}>
          <Input
            type="text"
            placeholder="Name your target"
            disabled={disabled}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Button colorScheme="primary" disabled={disabled || name.length === 0} onClick={submit}>
            Save
          </Button>
        </form>
      </Card.Content>
    </Card.Root>
  );
};
