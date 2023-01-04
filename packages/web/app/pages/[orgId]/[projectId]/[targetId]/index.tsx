import { ChangeEventHandler, ReactElement, useCallback, useState } from 'react';
import {
  Editable,
  EditableInput,
  EditablePreview,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react';
import { VscClose } from 'react-icons/vsc';
import { gql, useMutation, useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { DataWrapper, GraphQLBlock, noSchema, Title } from '@/components/v2';
import { CompositeSchemaFieldsFragment, SingleSchemaFieldsFragment } from '@/gql/graphql';
import {
  LatestSchemaDocument,
  OrganizationFieldsFragment,
  ProjectFieldsFragment,
  ProjectType,
  TargetFieldsFragment,
} from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { withSessionProtection } from '@/lib/supertokens/guard';

function isCompositeSchema(
  schema: SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment,
): schema is CompositeSchemaFieldsFragment {
  return schema.__typename === 'CompositeSchema';
}

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
                ...SingleSchemaFields
                ...CompositeSchemaFields
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
  schema: CompositeSchemaFieldsFragment;
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
  schemas: Array<SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment>;
  version: string;
  filterService?: string;
}): ReactElement => {
  if (project.type === ProjectType.Single) {
    const schema = schemas[0];
    return (
      <GraphQLBlock
        className="mb-6"
        sdl={schema.source}
        url={'url' in schema && typeof schema.url === 'string' ? schema.url : ''}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {schemas
        .filter(isCompositeSchema)
        .filter(schema => {
          if (filterService && 'service' in schema && schema.service) {
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
