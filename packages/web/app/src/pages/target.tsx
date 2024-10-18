import { ReactElement, useState } from 'react';
import { ChevronsUpDown, XIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { EmptyList, noSchema, noSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QueryError } from '@/components/ui/query-error';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion } from '@/components/v2/accordion';
import { GraphQLBlock, GraphQLHighlight } from '@/components/v2/graphql-block';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType, RegistryModel } from '@/gql/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { Link, useRouter } from '@tanstack/react-router';

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

function SchemaBlock({ schema }: { schema: CompositeSchema }) {
  return (
    <Accordion.Item value={schema.id} key={schema.id} className="border-2 border-gray-900/50">
      <Accordion.Header>
        <div>
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
      <Accordion className="space-y-4" type="single">
        {props.schemas.map(schema => (
          <SchemaBlock key={schema.id} schema={schema} />
        ))}
      </Accordion>
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

  return (
    <Accordion type="single" disabled value={schema.id}>
      <SchemaBlock key={schema.id} schema={schema} />
    </Accordion>
  );
}

const SchemaView_OrganizationFragment = graphql(`
  fragment SchemaView_OrganizationFragment on Organization {
    id
    slug
    me {
      ...CanAccessTarget_MemberFragment
    }
  }
`);

const SchemaView_ProjectFragment = graphql(`
  fragment SchemaView_ProjectFragment on Project {
    id
    slug
    type
    registryModel
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
}): ReactElement | null {
  const organization = useFragment(SchemaView_OrganizationFragment, props.organization);
  const project = useFragment(SchemaView_ProjectFragment, props.project);
  const target = useFragment(SchemaView_TargetFragment, props.target);
  const router = useRouter();
  const selectedServiceName =
    'service' in router.latestLocation.search &&
    typeof router.latestLocation.search.service === 'string'
      ? router.latestLocation.search.service
      : null;

  const [open, setOpen] = useState(false);
  const reset = () => {
    void router.navigate({
      search: {},
    });
  };

  const isDistributed =
    project.type === ProjectType.Federation || project.type === ProjectType.Stitching;

  const canManage = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
    organizationSlug: organization.slug,
    projectSlug: project.slug,
    targetSlug: target.slug,
  });

  const { latestSchemaVersion } = target;
  if (!latestSchemaVersion) {
    return noSchemaVersion;
  }

  if (!latestSchemaVersion.schemas.nodes.length) {
    return noSchema;
  }

  const canMarkAsValid = project.registryModel === RegistryModel.Legacy && canManage;

  const schemas = useFragment(SchemaView_SchemaFragment, target.latestSchemaVersion?.schemas.nodes);
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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-[400px] justify-between"
                  aria-expanded={open}
                >
                  {selectedServiceName ?? 'Select service'}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              {selectedServiceName ? (
                <Button variant="outline" onClick={reset}>
                  <XIcon width={16} height={16} />
                </Button>
              ) : null}
              <PopoverContent className="w-[400px] truncate p-0">
                <Command>
                  <CommandInput
                    closeFn={reset}
                    className="w-[400px]"
                    placeholder="Search service..."
                  />
                  <CommandEmpty>No results.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="relative h-80 w-full">
                      {compositeSchemas?.map(schema => (
                        <CommandItem
                          key={schema.service}
                          value={schema.service as string}
                          onSelect={serviceName => {
                            setOpen(false);
                            void router.navigate({
                              search: { service: serviceName },
                            });
                          }}
                          className="cursor-pointer truncate"
                        >
                          <div>
                            <div>{schema.service}</div>
                            <div className="text-muted-foreground text-xs">{schema.url}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {canMarkAsValid ? (
            <>
              <MarkAsValid
                organizationSlug={organization.slug}
                projectSlug={project.slug}
                targetSlug={target.slug}
                version={latestSchemaVersion}
              />{' '}
            </>
          ) : null}
        </div>
      </div>
      {isDistributed ? <Schemas schemas={schemasToDisplay} /> : <Schemas schema={singleSchema} />}
    </>
  );
}

const TargetSchemaPageQuery = graphql(`
  query TargetSchemaPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        ...SchemaView_OrganizationFragment
      }
    }
    project(selector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug }) {
      ...SchemaView_ProjectFragment
    }
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      ...SchemaView_TargetFragment
    }
  }
`);

function TargetSchemaPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [query] = useQuery({
    query: TargetSchemaPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
    },
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const target = query.data?.target;

  return (
    <TargetLayout
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
      page={Page.Schema}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Schema</Title>
          <Subtitle>The latest published schema.</Subtitle>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Button variant="outline" asChild>
            <Link
              to="/$organizationSlug/$projectSlug/$targetSlug/explorer/unused"
              params={{
                organizationSlug: props.organizationSlug,
                projectSlug: props.projectSlug,
                targetSlug: props.targetSlug,
              }}
            >
              Unused schema
            </Link>
          </Button>
          <span className="italic">|</span>
          <Button variant="outline" asChild>
            <Link
              to="/$organizationSlug/$projectSlug/$targetSlug/explorer/deprecated"
              params={{
                organizationSlug: props.organizationSlug,
                projectSlug: props.projectSlug,
                targetSlug: props.targetSlug,
              }}
            >
              Deprecated schema
            </Link>
          </Button>
        </div>
      </div>
      <div>
        {query.fetching ? null : currentOrganization && currentProject && target ? (
          <SchemaView organization={currentOrganization} project={currentProject} target={target} />
        ) : null}
      </div>
    </TargetLayout>
  );
}

export function TargetPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="Schema" />
      <TargetSchemaPage
        organizationSlug={props.organizationSlug}
        projectSlug={props.projectSlug}
        targetSlug={props.targetSlug}
      />
    </>
  );
}
