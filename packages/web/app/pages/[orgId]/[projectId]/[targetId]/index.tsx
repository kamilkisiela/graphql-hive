import { ChangeEventHandler, ReactElement, useCallback, useState } from 'react';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { Accordion, DataWrapper, GraphQLBlock, Input, noSchema, Title } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { GraphQLHighlight } from '@/components/v2/graphql-block';
import { FragmentType, graphql, useFragment } from '@/gql';
import { CompositeSchemaFieldsFragment, SingleSchemaFieldsFragment } from '@/gql/graphql';
import { LatestSchemaDocument, ProjectType, RegistryModel } from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { withSessionProtection } from '@/lib/supertokens/guard';

function isCompositeSchema(
  schema: SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment,
): schema is CompositeSchemaFieldsFragment {
  return schema.__typename === 'CompositeSchema';
}

function SchemaBlock({ schema }: { schema: CompositeSchemaFieldsFragment }) {
  return (
    <Accordion.Item value={schema.id} key={schema.id} className="border-2 border-gray-900/50">
      <Accordion.Header>
        <div>
          <div className="text-base" id={schema.service ?? undefined}>
            {schema.service ?? 'SDL'}
          </div>
          {schema.url ? <div className="text-xs text-gray-500">{schema.url}</div> : null}
        </div>
      </Accordion.Header>
      <Accordion.Content>
        <div className="p-2">
          <GraphQLHighlight code={schema.source} />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

const Schemas_ProjectFragment = graphql(`
  fragment Schemas_ProjectFragment on Project {
    type
  }
`);

function Schemas({
  filterService,
  schemas = [],
  ...props
}: {
  project: FragmentType<typeof Schemas_ProjectFragment>;
  schemas: Array<SingleSchemaFieldsFragment | CompositeSchemaFieldsFragment>;
  filterService?: string;
}): ReactElement {
  const project = useFragment(Schemas_ProjectFragment, props.project);

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

  const filteredSchemas = schemas.filter(isCompositeSchema).filter(schema => {
    if (filterService && 'service' in schema && schema.service) {
      return schema.service.toLowerCase().includes(filterService.toLowerCase());
    }

    return true;
  });

  // Display format should be defined based on the length of `schemas`, and not `filteredSchemas`.
  // Otherwise, the accordion will be displayed by default but the list (disabled accordion) when filtering.
  const displayFormat = schemas.length > 7 ? 'dynamic' : 'static';

  return (
    <div className="flex flex-col gap-8">
      {displayFormat === 'dynamic' ? (
        <Accordion type="multiple">
          {filteredSchemas.map(schema => (
            <SchemaBlock key={schema.id} schema={schema} />
          ))}
        </Accordion>
      ) : (
        <Accordion type="multiple" value={filteredSchemas.map(s => s.id)} disabled>
          {filteredSchemas.map(schema => (
            <SchemaBlock key={schema.id} schema={schema} />
          ))}
        </Accordion>
      )}
    </div>
  );
}

const SchemaView_OrganizationFragment = graphql(`
  fragment SchemaView_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessTarget_MemberFragment
    }
  }
`);

const SchemaView_ProjectFragment = graphql(`
  fragment SchemaView_ProjectFragment on Project {
    cleanId
    type
    registryModel
    ...Schemas_ProjectFragment
  }
`);

const SchemaView_TargetFragment = graphql(`
  fragment SchemaView_TargetFragment on Target {
    cleanId
    latestSchemaVersion {
      schemas {
        nodes {
          __typename
        }
      }
    }
  }
`);

function SchemaView(props: {
  organization: FragmentType<typeof SchemaView_OrganizationFragment>;
  project: FragmentType<typeof SchemaView_ProjectFragment>;
  target: FragmentType<typeof SchemaView_TargetFragment>;
}): ReactElement | null {
  const organization = useFragment(SchemaView_OrganizationFragment, props.organization);
  const project = useFragment(SchemaView_ProjectFragment, props.project);
  const target = useFragment(SchemaView_TargetFragment, props.target);
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
        const latestSchemaVersion = query.data?.target?.latestSchemaVersion;
        if (!latestSchemaVersion) {
          return noSchemaVersion;
        }

        if (!latestSchemaVersion.schemas.nodes.length) {
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
                    <MarkAsValid version={latestSchemaVersion} />{' '}
                  </>
                ) : null}
              </div>
            </div>
            <Schemas
              project={project}
              filterService={filterService}
              schemas={latestSchemaVersion.schemas.nodes ?? []}
            />
          </>
        );
      }}
    </DataWrapper>
  );
}

const TargetSchemaPageQuery = graphql(`
  query TargetSchemaPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
        ...SchemaView_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
      ...SchemaView_ProjectFragment
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      ...SchemaView_TargetFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function SchemaPage(): ReactElement {
  return (
    <>
      <Title title="Schema" />
      <TargetLayout value="schema" query={TargetSchemaPageQuery}>
        {props => (
          <SchemaView
            target={props.target!}
            organization={props.organization!.organization}
            project={props.project!}
          />
        )}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SchemaPage);
