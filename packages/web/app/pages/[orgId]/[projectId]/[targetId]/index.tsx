import { ChangeEventHandler, ReactElement, useCallback, useState } from 'react';
import {
  Editable,
  EditableInput,
  EditablePreview,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Tooltip,
} from '@chakra-ui/react';
import { VscClose } from 'react-icons/vsc';
import { gql, useMutation, useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';

import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { Button, DataWrapper, GraphQLBlock, noSchema, Title } from '@/components/v2';
import { RefreshIcon } from '@/components/v2/icon';
import { SchemaFieldsFragment } from '@/gql/graphql';
import {
  LatestSchemaDocument,
  OrganizationFieldsFragment,
  ProjectFieldsFragment,
  ProjectType,
  TargetFieldsFragment,
} from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { withSessionProtection } from '@/lib/supertokens/guard';

const SchemaServiceName_UpdateSchemaServiceName = gql(/* GraphQL */ `
  mutation SchemaServiceName_UpdateSchemaServiceName($input: UpdateSchemaServiceNameInput!) {
    updateSchemaServiceName(input: $input) {
      ok {
        updatedTarget {
          ...TargetFields
          latestSchemaVersion {
            id
            valid
            schemas {
              nodes {
                ...SchemaFields
              }
            }
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const SchemaServiceName = ({
  target,
  project,
  organization,
  schema,
  version,
}: {
  version: string;
  schema: SchemaFieldsFragment;
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}): ReactElement => {
  const [mutation, mutate] = useMutation(SchemaServiceName_UpdateSchemaServiceName);
  const hasAccess = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  const submit = useCallback(
    async (newName: string) => {
      if (schema.service === newName) {
        return;
      }

      if (newName.trim().length === 0) {
        return;
      }

      await mutate({
        input: {
          organization: organization.cleanId,
          project: project.cleanId,
          target: target.cleanId,
          version,
          name: schema.service!,
          newName,
        },
      });
    },
    [mutate, organization.cleanId, project.cleanId, schema.service, target.cleanId, version],
  );

  if (
    (project.type !== ProjectType.Federation && project.type !== ProjectType.Stitching) ||
    !hasAccess
  ) {
    return <>{schema.service}</>;
  }

  return (
    <Editable defaultValue={schema.service ?? ''} isDisabled={mutation.fetching} onSubmit={submit}>
      <EditablePreview />
      <EditableInput />
    </Editable>
  );
};

const Schemas = ({
  organization,
  project,
  target,
  filterService,
  version,
  schemas = [],
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
  schemas: SchemaFieldsFragment[];
  version: string;
  filterService?: string;
}): ReactElement => {
  if (project.type === ProjectType.Single) {
    return <GraphQLBlock className="mb-6" sdl={schemas[0].source} url={schemas[0]?.url ?? ''} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {schemas
        .filter(schema => {
          if (filterService && schema.service) {
            return schema.service.toLowerCase().includes(filterService.toLowerCase());
          }

          return true;
        })
        .map(schema => (
          <GraphQLBlock
            key={schema.id}
            sdl={schema.source}
            url={schema.url ?? ''}
            title={
              <SchemaServiceName
                version={version}
                schema={schema}
                target={target}
                project={project}
                organization={organization}
              />
            }
          />
        ))}
    </div>
  );
};

const SchemaSyncButton_SchemaSyncCDN = gql(/* GraphQL */ `
  mutation schemaSyncCdn($input: SchemaSyncCDNInput!) {
    schemaSyncCDN(input: $input) {
      __typename
      ... on SchemaSyncCDNSuccess {
        message
      }
      ... on SchemaSyncCDNError {
        message
      }
    }
  }
`);

const SyncSchemaButton = ({
  target,
  project,
  organization,
}: {
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}): ReactElement | null => {
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [mutation, mutate] = useMutation(SchemaSyncButton_SchemaSyncCDN);

  const sync = useCallback(async () => {
    const result = await mutate({
      input: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    });
    if (result.error) {
      setStatus('error');
    } else {
      setStatus(
        result.data?.schemaSyncCDN.__typename === 'SchemaSyncCDNError' ? 'error' : 'success',
      );
    }
    setTimeout(() => {
      setStatus('idle');
    }, 5000);
  }, [mutate, organization.cleanId, project.cleanId, target.cleanId]);

  if (!target.hasSchema) {
    return null;
  }

  return (
    <Tooltip
      label="Re-upload the latest valid version to Hive CDN"
      fontSize="xs"
      placement="bottom-start"
    >
      <Button
        variant="primary"
        size="large"
        onClick={sync}
        disabled={status !== 'idle' || mutation.fetching}
      >
        {mutation.fetching
          ? 'Syncing…'
          : FetchingMessages[status as keyof typeof FetchingMessages] ?? 'CDN is up to date'}
        <RefreshIcon className="ml-8 h-4 w-4" />
      </Button>
    </Tooltip>
  );
};

const FetchingMessages = {
  idle: 'Update CDN',
  error: 'Failed to synchronize',
} as const;

function SchemaView({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}): ReactElement | null {
  const [filterService, setFilterService] = useState<string>('');
  const [term, setTerm] = useState<string>('');
  const debouncedFilter = useDebouncedCallback((value: string) => {
    setFilterService(value);
  }, 500);
  const handleChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    event => {
      debouncedFilter(event.target.value);
      setTerm(event.target.value);
    },
    [debouncedFilter, setTerm],
  );
  const reset = useCallback(() => {
    setFilterService('');
    setTerm('');
  }, [setFilterService]);

  const isDistributed =
    project.type === ProjectType.Federation || project.type === ProjectType.Stitching;

  const [query] = useQuery({
    query: LatestSchemaDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    },
    requestPolicy: 'cache-first',
  });

  const canManage = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  return (
    <DataWrapper query={query}>
      {query => {
        if (!query.data?.target?.latestSchemaVersion?.schemas.nodes.length) {
          return noSchema;
        }

        return (
          <>
            <div className="mb-5 flex flex-row items-center justify-between">
              <div className="font-light text-gray-500">The latest published schema.</div>
              <div className="flex flex-row items-center gap-4">
                {isDistributed && (
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                    }}
                  >
                    <InputGroup size="sm" variant="filled">
                      <Input
                        type="text"
                        placeholder="Find service"
                        value={term}
                        onChange={handleChange}
                      />
                      <InputRightElement>
                        <IconButton
                          aria-label="Reset"
                          size="xs"
                          variant="ghost"
                          onClick={reset}
                          icon={<VscClose />}
                        />
                      </InputRightElement>
                    </InputGroup>
                  </form>
                )}
                {canManage ? (
                  <>
                    <MarkAsValid version={query.data.target.latestSchemaVersion} />{' '}
                    <SyncSchemaButton
                      target={target}
                      project={project}
                      organization={organization}
                    />
                  </>
                ) : null}
              </div>
            </div>
            <Schemas
              organization={organization}
              project={project}
              target={query.data.target}
              filterService={filterService}
              version={query.data.target.latestSchemaVersion.id}
              schemas={query.data.target.latestSchemaVersion.schemas.nodes ?? []}
            />
          </>
        );
      }}
    </DataWrapper>
  );
}

function SchemaPage(): ReactElement {
  return (
    <>
      <Title title="Schema" />
      <TargetLayout value="schema">{props => <SchemaView {...props} />}</TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SchemaPage);
