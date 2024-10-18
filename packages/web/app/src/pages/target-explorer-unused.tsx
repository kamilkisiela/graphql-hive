import { memo, useEffect, useMemo, useState } from 'react';
import { AlertCircleIcon, PartyPopperIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { SchemaVariantFilter } from '@/components/target/explorer/filter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { EmptyList, noSchemaVersion } from '@/components/ui/empty-list';
import { Link } from '@/components/ui/link';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { cn } from '@/lib/utils';
import { TypeRenderer, TypeRenderFragment } from './target-explorer-type';

const UnusedSchemaView_UnusedSchemaExplorerFragment = graphql(`
  fragment UnusedSchemaView_UnusedSchemaExplorerFragment on UnusedSchemaExplorer {
    types {
      __typename
      ... on GraphQLObjectType {
        name
      }
      ... on GraphQLInterfaceType {
        name
      }
      ... on GraphQLUnionType {
        name
      }
      ... on GraphQLEnumType {
        name
      }
      ... on GraphQLInputObjectType {
        name
      }
      ... on GraphQLScalarType {
        name
      }
      ...TypeRenderFragment
    }
  }
`);

const UnusedSchemaView = memo(function _UnusedSchemaView(props: {
  explorer: FragmentType<typeof UnusedSchemaView_UnusedSchemaExplorerFragment>;
  totalRequests: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [selectedLetter, setSelectedLetter] = useState<string>();
  const { types } = useFragment(UnusedSchemaView_UnusedSchemaExplorerFragment, props.explorer);

  const typesGroupedByFirstLetter = useMemo(() => {
    const grouped = new Map<string, FragmentType<typeof TypeRenderFragment>[]>([]);

    for (const type of types) {
      const letter = type.name[0].toLocaleUpperCase();
      const existingNameGroup = grouped.get(letter);

      if (existingNameGroup) {
        existingNameGroup.push(type);
      } else {
        grouped.set(letter, [type]);
      }
    }
    return grouped;
  }, [types]);

  const letters = Array.from(typesGroupedByFirstLetter.keys()).sort();

  useEffect(() => {
    if (!selectedLetter) {
      setSelectedLetter(letters[0]);
    }
  }, [selectedLetter, setSelectedLetter]);

  if (types.length === 0) {
    return (
      <div className="flex h-[250px] shrink-0 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <PartyPopperIcon className="size-10 text-emerald-500" />

          <h3 className="mt-4 text-lg font-semibold">No unused types</h3>
          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            It looks like you are using all typea in your schema, congratulations!
          </p>
        </div>
      </div>
    );
  }

  if (!selectedLetter) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <TooltipProvider>
          {letters.map(letter => (
            <Tooltip key={letter} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setSelectedLetter(letter)}
                  variant={letter === selectedLetter ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'rounded-none px-2 py-1',
                    letter === selectedLetter
                      ? 'text-orange-500'
                      : 'text-gray-500 hover:text-orange-500',
                  )}
                  key={letter}
                >
                  {letter}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {typesGroupedByFirstLetter.get(letter)?.length ?? 0} types
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      <div className="flex flex-col gap-4">
        {(typesGroupedByFirstLetter.get(selectedLetter) ?? []).map((type, i) => {
          return (
            <TypeRenderer
              key={i}
              type={type}
              organizationSlug={props.organizationSlug}
              projectSlug={props.projectSlug}
              targetSlug={props.targetSlug}
              warnAboutDeprecatedArguments={false}
              warnAboutUnusedArguments
              styleDeprecated
            />
          );
        })}
      </div>
    </div>
  );
});

const UnusedSchemaExplorer_UnusedSchemaQuery = graphql(`
  query UnusedSchemaExplorer_UnusedSchemaQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $period: DateRangeInput!
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      slug
      latestSchemaVersion {
        id
      }
      latestValidSchemaVersion {
        __typename
        id
        valid
        unusedSchema(usage: { period: $period }) {
          ...UnusedSchemaView_UnusedSchemaExplorerFragment
        }
      }
    }
    operationsStats(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
        period: $period
      }
    ) {
      totalRequests
    }
  }
`);

function UnusedSchemaExplorer(props: {
  dataRetentionInDays: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const dateRangeController = useDateRangeController({
    dataRetentionInDays: props.dataRetentionInDays,
    defaultPreset: presetLast7Days,
  });

  const [query, refresh] = useQuery({
    query: UnusedSchemaExplorer_UnusedSchemaQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      period: dateRangeController.resolvedRange,
    },
  });

  useEffect(() => {
    if (!query.fetching) {
      refresh({ requestPolicy: 'network-only' });
    }
  }, [dateRangeController.resolvedRange]);

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const latestSchemaVersion = query.data?.target?.latestSchemaVersion;
  const latestValidSchemaVersion = query.data?.target?.latestValidSchemaVersion;

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Unused Schema</Title>
          <Subtitle>
            Helps you understand the coverage of GraphQL schema and safely remove the unused part
          </Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <DateRangePicker
            validUnits={['y', 'M', 'w', 'd', 'h']}
            selectedRange={dateRangeController.selectedPreset.range}
            startDate={dateRangeController.startDate}
            align="end"
            onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
          />
          <SchemaVariantFilter
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            targetSlug={props.targetSlug}
            variant="unused"
          />
        </div>
      </div>
      {!query.fetching && (
        <>
          {latestValidSchemaVersion?.unusedSchema && latestSchemaVersion ? (
            <>
              {latestSchemaVersion.id !== latestValidSchemaVersion.id && (
                <Alert className="mb-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertTitle>Outdated Schema</AlertTitle>
                  <AlertDescription className="max-w-[600px]">
                    The latest schema version is <span className="font-bold">not valid</span> , thus
                    the explorer might not be accurate as it is showing the{' '}
                    <span className="font-bold">latest valid</span> schema version. We recommend you
                    to publish a new schema version that is composable before using this explorer
                    for decision making.
                    <br />
                    <br />
                    <Link
                      to="/$organizationSlug/$projectSlug/$targetSlug/history/$versionId"
                      params={{
                        organizationSlug: props.organizationSlug,
                        projectSlug: props.projectSlug,
                        targetSlug: props.targetSlug,
                        versionId: latestSchemaVersion.id,
                      }}
                    >
                      <span className="font-bold"> See the invalid schema version</span>
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
              <UnusedSchemaView
                totalRequests={query.data?.operationsStats.totalRequests ?? 0}
                explorer={latestValidSchemaVersion.unusedSchema}
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
              />
            </>
          ) : (
            noSchemaVersion
          )}
        </>
      )}
    </>
  );
}

const TargetExplorerUnusedSchemaPageQuery = graphql(`
  query TargetExplorerUnusedSchemaPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        rateLimit {
          retentionInDays
        }
        slug
      }
    }
    hasCollectedOperations(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    )
  }
`);

function ExplorerUnusedSchemaPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [query] = useQuery({
    query: TargetExplorerUnusedSchemaPageQuery,
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
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      page={Page.Explorer}
    >
      {currentOrganization ? (
        hasCollectedOperations ? (
          <UnusedSchemaExplorer
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            targetSlug={props.targetSlug}
          />
        ) : (
          <div className="py-8">
            <EmptyList
              title="Hive is waiting for your first collected operation"
              description="You can collect usage of your GraphQL API with Hive Client"
              docsUrl="/features/usage-reporting"
            />
          </div>
        )
      ) : null}
    </TargetLayout>
  );
}

export function TargetExplorerUnusedPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="Unused Schema Explorer" />
      <ExplorerUnusedSchemaPageContent {...props} />
    </>
  );
}
