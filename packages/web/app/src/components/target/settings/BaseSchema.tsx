import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import Editor from '@monaco-editor/react';
import { Button, Text } from '@chakra-ui/react';
import { Card, Description } from '@/components/common';
import { TargetFieldsFragment, UpdateBaseSchemaDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

function isEqual(left: string | null, right: string | null) {
  const l = left ? left.trim() : '';
  const r = right ? right.trim() : '';

  return l === r;
}

const SchemaEditor = ({
  readOnly,
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}) => {
  return (
    <Editor
      theme="vs-dark"
      language="graphql"
      options={{
        lineNumbers: 'on',
        readOnly,
      }}
      height={300}
      value={value}
      onChange={onChange}
    />
  );
};

export const BaseSchemaSettings: React.FC<{
  target: TargetFieldsFragment;
}> = ({ target }) => {
  const router = useRouteSelector();
  const [mutation, mutate] = useMutation(UpdateBaseSchemaDocument);
  const [baseSchema, setBaseSchema] = React.useState(target.baseSchema);
  const [loading, setLoading] = React.useState(false);

  const submit = React.useCallback(() => {
    setLoading(true);
    mutate({
      input: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        newBase: baseSchema,
      },
    }).finally(() => {
      setLoading(false);
    });
  }, [baseSchema, setLoading, mutate, router]);

  const reset = React.useCallback(() => {
    setBaseSchema(target.baseSchema);
  }, [setBaseSchema]);

  const disabled = !!mutation.error || loading;
  const isUnsaved = !isEqual(baseSchema, target.baseSchema);

  return (
    <>
      <Card.Root>
        <Card.Title>Extend Your Schema</Card.Title>
        <Card.Content>
          <p>
            Define a piece of SDL that will be added to every published schema.
          </p>
          <Description tw="mt-3">
            Useful for AWS AppSync users to not send platform-specific part of
            schema to Hive.
          </Description>
          <div tw="py-3">
            <SchemaEditor
              value={baseSchema}
              onChange={setBaseSchema}
              readOnly={disabled}
            />
          </div>
          <div tw="flex flex-row items-center space-x-3">
            <Button
              colorScheme="primary"
              size="sm"
              disabled={disabled}
              isLoading={loading}
              onClick={submit}
            >
              Save
            </Button>
            <Button
              colorScheme="gray"
              size="sm"
              disabled={disabled}
              onClick={reset}
            >
              Reset
            </Button>
            {isUnsaved && (
              <Text fontSize="xs" as="strong" color="teal.600">
                unsaved changes!
              </Text>
            )}
          </div>
        </Card.Content>
      </Card.Root>
    </>
  );
};
