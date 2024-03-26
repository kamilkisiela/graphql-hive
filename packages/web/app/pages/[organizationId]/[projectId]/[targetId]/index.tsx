import { ChangeEventHandler, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'urql';
import { useDebouncedCallback } from 'use-debounce';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { Button } from '@/components/ui/button';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Accordion, GraphQLBlock, Input, MetaTitle, noSchema } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { GraphQLHighlight } from '@/components/v2/graphql-block';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType, RegistryModel } from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useRouteSelector } from '@/lib/hooks';

type CompositeSchema = Extract<
  DocumentType<typeof SchemaView_SchemaFragment>,
  {
    __typename?: 'CompositeSchema';
  }
>;

function isCompositeSchema(
  schema: DocumentType<typeof SchemaView_SchemaFragment>,
): schema is CompositeSchema {
  return schema.__typename === 'CompositeSchema';
}

function SchemaBlock({ schema, scrollToMe }: { schema: CompositeSchema; scrollToMe: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (scrollToMe && ref.current && scrolled.current === false) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
      scrolled.current = true;
    }
  }, [ref.current, scrolled.current]);

  return (
    <Accordion.Item value={schema.id} key={schema.id} className="border-2 border-gray-900/50">
      <Accordion.Header>
        <div ref={ref}>
          <div className="text-base" id={schema.service ? `service-${schema.service}` : undefined}>
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
  ...props
}: {
  project: FragmentType<typeof Schemas_ProjectFragment>;
  schemas: FragmentType<typeof SchemaView_SchemaFragment>[];
  filterService?: string;
}): ReactElement {
  const project = useFragment(Schemas_ProjectFragment, props.project);
  const schemas = useFragment(SchemaView_SchemaFragment, props.schemas);

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
            <SchemaBlock
              key={schema.id}
              schema={schema}
              scrollToMe={filterService?.toLowerCase() === schema.service?.toLowerCase()}
            />
          ))}
        </Accordion>
      ) : (
        <Accordion type="multiple" value={filteredSchemas.map(s => s.id)} disabled>
          {filteredSchemas.map(schema => (
            <SchemaBlock
              key={schema.id}
              schema={schema}
              scrollToMe={filterService?.toLowerCase() === schema.service?.toLowerCase()}
            />
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

const SchemaView_SchemaFragment = graphql(`
  fragment SchemaView_SchemaFragment on Schema {
    ... on SingleSchema {
      id
      author
      source
      commit
    }
    ... on CompositeSchema {
      id
      author
      source
      service
      url
      commit
    }
  }
`);

const SchemaView_TargetFragment = graphql(`
  fragment SchemaView_TargetFragment on Target {
    id
    cleanId
    latestSchemaVersion {
      id
      schemas {
        nodes {
          __typename
          ...SchemaView_SchemaFragment
        }
      }
      ...MarkAsValid_SchemaVersionFragment
    }
  }
`);

function SchemaView(props: {
  organization: FragmentType<typeof SchemaView_OrganizationFragment>;
  project: FragmentType<typeof SchemaView_ProjectFragment>;
  target: FragmentType<typeof SchemaView_TargetFragment>;
  highlightedService: string | null;
}): ReactElement | null {
  const organization = useFragment(SchemaView_OrganizationFragment, props.organization);
  const project = useFragment(SchemaView_ProjectFragment, props.project);
  const target = useFragment(SchemaView_TargetFragment, props.target);
  const [filterService, setFilterService] = useState(props.highlightedService ?? '');
  const [term, setTerm] = useState(props.highlightedService ?? '');
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

  const canManage = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  const { latestSchemaVersion } = target;
  if (!latestSchemaVersion) {
    return noSchemaVersion;
  }

  if (!latestSchemaVersion.schemas.nodes.length) {
    return noSchema;
  }

  const canMarkAsValid = project.registryModel === RegistryModel.Legacy;
  const showExtra = canManage;

  return (
    <>
      {showExtra ? (
        <div className="mb-5 flex flex-row items-center justify-between">
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
            {canMarkAsValid ? (
              <>
                <MarkAsValid version={latestSchemaVersion} />{' '}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <Schemas
        project={project}
        filterService={filterService}
        schemas={target.latestSchemaVersion?.schemas.nodes ?? []}
      />
    </>
  );
}

const TargetSchemaPageQuery = graphql(`
  query TargetSchemaPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        ...SchemaView_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      ...SchemaView_ProjectFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      ...SchemaView_TargetFragment
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function TargetSchemaPage() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetSchemaPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;
  const target = query.data?.target;
  const isCDNEnabled = query.data;
  const serviceNameFromHash = router.asPath.split('#')[1]?.replace('service-', '') ?? null;

  return (
    <TargetLayout
      page={Page.Schema}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Schema</Title>
          <Subtitle>The latest published schema.</Subtitle>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link
              href={{
                pathname: '/[organizationId]/[projectId]/[targetId]/explorer/unused',
                query: {
                  organizationId: router.organizationId,
                  projectId: router.projectId,
                  targetId: router.targetId,
                },
              }}
            >
              Show unused schema
            </Link>
          </Button>
        </div>
      </div>
      <div>
        {query.fetching ? null : currentOrganization && currentProject && target ? (
          <SchemaView
            organization={currentOrganization}
            project={currentProject}
            target={target}
            highlightedService={serviceNameFromHash}
          />
        ) : null}
      </div>
    </TargetLayout>
  );
}

function SchemaPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Schema" />
      <TargetSchemaPage />
    </>
  );
}

export default authenticated(SchemaPage);
