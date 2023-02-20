import { ChangeEventHandler, ReactElement, useCallback, useState } from 'react';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { DataWrapper, GraphQLBlock, Input, noSchema, Title } from '@/components/v2';
import { CompositeSchemaFieldsFragment, SingleSchemaFieldsFragment } from '@/gql/graphql';
import {
  LatestSchemaDocument,
  OrganizationFieldsFragment,
  ProjectFieldsFragment,
  ProjectType,
  RegistryModel,
  TargetFieldsFragment,
} from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { withSessionProtection } from '@/lib/supertokens/guard';

function isCompositeSchema(
  schema: SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment,
): schema is CompositeSchemaFieldsFragment {
  return schema.__typename === 'CompositeSchema';
}

function Schemas({
  project,
  filterService,
  schemas = [],
}: {
  project: ProjectFieldsFragment;
  schemas: Array<SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment>;
  filterService?: string;
}): ReactElement {
  if (project.type === ProjectType.Single) {
    const [schema] = schemas;
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
            title={schema.service}
          />
        ))}
    </div>
  );
}

function SchemaView({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}): ReactElement | null {
  const [filterService, setFilterService] = useState('');
  const [term, setTerm] = useState('');
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
                  <Input
                    placeholder="Find service"
                    value={term}
                    onChange={handleChange}
                    onClear={reset}
                    size="small"
                  />
                )}
                {canManage && project.registryModel === RegistryModel.Legacy ? (
                  <>
                    <MarkAsValid version={query.data.target.latestSchemaVersion} />{' '}
                  </>
                ) : null}
              </div>
            </div>
            <Schemas
              project={project}
              filterService={filterService}
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
