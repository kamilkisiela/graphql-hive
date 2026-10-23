import { ReactElement } from 'react';
import { XIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import { EmptyList, noSchema, NoSchemaVersion } from '@/components/ui/empty-list';
import { GraphQLBlock, GraphQLHighlight } from '@/components/ui/graphql-block';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Accordion } from '@/components/ui/primitives/accordion/accordion';
import { Button } from '@/components/ui/primitives/button/button';
import { Card } from '@/components/ui/primitives/card/card';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { QueryError } from '@/components/ui/query-error';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { getRouteApi, Link } from '@tanstack/react-router';

const schemaRoute = getRouteApi(
  '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/',
);

type CompositeSchema = Extract<
  DocumentType<typeof SchemaView_SchemaFragment>,
  {
    __typename: 'CompositeSchema';
  }
>;

type SingleSchema = Extract<
  DocumentType<typeof SchemaView_SchemaFragment>,
  {
    __typename: 'SingleSchema';
  }
>;

function isCompositeSchema(
  schema: DocumentType<typeof SchemaView_SchemaFragment>,
): schema is CompositeSchema {
  return schema.__typename === 'CompositeSchema';
}

/** The service's name, an anchor for deep links, and its URL. */
function serviceHeader(schema: CompositeSchema) {
  return (
    <div>
      <div className="text-base" id={schema.service ? `service-${schema.service}` : undefined}>
        {schema.service ?? 'SDL'}
      </div>
      {schema.url ? (
        <div className="text-xs font-normal text-fg-secondary">{schema.url}</div>
      ) : null}
    </div>
  );
}

function serviceSchema(schema: CompositeSchema) {
  return (
    <div className="p-2">
      <GraphQLHighlight code={schema.source} />
    </div>
  );
}

function Schemas(props: { schemas?: readonly CompositeSchema[]; schema?: SingleSchema }) {
  if (props.schema) {
    return (
      <GraphQLBlock
        sdl={props.schema.source}
        url={'url' in props.schema && typeof props.schema.url === 'string' ? props.schema.url : ''}
      />
    );
  }

  if (!props.schemas) {
    console.error('No schema or schemas props provided');
    return null;
  }

  if (props.schemas.length > 1) {
    return (
      <Accordion
        variant="boxed"
        items={props.schemas.map(schema => ({
          value: schema.id,
          label: serviceHeader(schema),
          content: serviceSchema(schema),
        }))}
      />
    );
  }

  const schema = props.schemas[0];

  if (!schema) {
    return (
      <EmptyList
        title="Service not found"
        description="You can publish the missing service with Hive CLI"
      />
    );
  }

  // One service has nothing to collapse, so it is a card, not an accordion locked open.
  return (
    <Card>
      {serviceHeader(schema)}
      {serviceSchema(schema)}
    </Card>
  );
}

const SchemaView_ProjectFragment = graphql(`
  fragment SchemaView_ProjectFragment on Project {
    id
    type
  }
`);

const SchemaView_SchemaFragment = graphql(`
  fragment SchemaView_SchemaFragment on Schema {
    __typename
    ... on SingleSchema {
      id
      source
    }
    ... on CompositeSchema {
      id
      source
      service
      url
    }
  }
`);

const SchemaView_TargetFragment = graphql(`
  fragment SchemaView_TargetFragment on Target {
    id
    slug
    latestSchemaVersion {
      id
      schemas {
        edges {
          node {
            __typename
            ...SchemaView_SchemaFragment
          }
        }
      }
    }
  }
`);

function SchemaView(props: {
  project: FragmentType<typeof SchemaView_ProjectFragment>;
  target: FragmentType<typeof SchemaView_TargetFragment>;
}): ReactElement | null {
  const project = useFragment(SchemaView_ProjectFragment, props.project);
  const target = useFragment(SchemaView_TargetFragment, props.target);
  const { service } = schemaRoute.useSearch();
  const navigate = schemaRoute.useNavigate();
  const selectedServiceName = service ?? null;

  const reset = () => {
    void navigate({
      search: {},
    });
  };

  const schemas = useFragment(
    SchemaView_SchemaFragment,
    target.latestSchemaVersion?.schemas?.edges?.map(edge => edge.node),
  );

  const isDistributed =
    project.type === ProjectType.Federation || project.type === ProjectType.Stitching;

  const { latestSchemaVersion } = target;
  if (!latestSchemaVersion) {
    return <NoSchemaVersion recommendedAction="publish" projectType={project.type} />;
  }

  if (!latestSchemaVersion.schemas.edges.length) {
    return noSchema;
  }

  const compositeSchemas = schemas?.filter(isCompositeSchema) as CompositeSchema[];
  const singleSchema = schemas?.filter(schema => !isCompositeSchema(schema))[0] as
    | SingleSchema
    | undefined;
  const schemasToDisplay = selectedServiceName
    ? compositeSchemas.filter(schema => schema.service === selectedServiceName)
    : compositeSchemas;

  return (
    <>
      <div className="mb-5 flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-4">
          {isDistributed && schemas && schemas.length > 1 && (
            <>
              <Select
                aria-label="Service"
                options={compositeSchemas.map(schema => ({
                  value: schema.service as string,
                  label: schema.service as string,
                  description: schema.url,
                }))}
                value={selectedServiceName ?? undefined}
                onValueChange={serviceName => {
                  void navigate({
                    search: { service: serviceName },
                  });
                }}
                placeholder="Select service"
                searchable
                searchPlaceholder="Search service..."
                width="lg"
              />
              {selectedServiceName ? (
                <Button variant="outline" onClick={reset} aria-label="Clear service">
                  <XIcon width={16} height={16} />
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {isDistributed ? <Schemas schemas={schemasToDisplay} /> : <Schemas schema={singleSchema} />}
    </>
  );
}

export const TargetSchemaPageQuery = graphql(`
  query TargetSchemaPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    project(
      reference: { bySelector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug } }
    ) {
      ...SchemaView_ProjectFragment
      target: targetBySlug(targetSlug: $targetSlug) {
        ...SchemaView_TargetFragment
      }
    }
  }
`);

function TargetSchemaPage() {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: TargetSchemaPageQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
    },
  });

  if (query.error) {
    return <QueryError organizationSlug={organizationSlug} error={query.error} />;
  }

  const currentProject = query.data?.project;
  const target = currentProject?.target;

  return (
    <LayoutContent>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Schema</Title>
          <Subtitle>The latest published schema.</Subtitle>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Button
            variant="outline"
            render={
              <Link
                to="/$organizationSlug/$projectSlug/$targetSlug/explorer/unused"
                params={{
                  organizationSlug,
                  projectSlug,
                  targetSlug,
                }}
              />
            }
          >
            Unused schema
          </Button>
          <span className="italic">|</span>
          <Button
            variant="outline"
            render={
              <Link
                to="/$organizationSlug/$projectSlug/$targetSlug/explorer/deprecated"
                params={{
                  organizationSlug,
                  projectSlug,
                  targetSlug,
                }}
              />
            }
          >
            Deprecated schema
          </Button>
        </div>
      </div>
      <div>
        {query.fetching ? null : currentProject && target ? (
          <SchemaView project={currentProject} target={target} />
        ) : null}
      </div>
    </LayoutContent>
  );
}

export function TargetPage() {
  return (
    <>
      <Meta title="Schema" />
      <TargetSchemaPage />
    </>
  );
}
