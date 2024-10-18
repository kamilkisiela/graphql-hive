import { useEffect, useRef } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import {
  ArgumentVisibilityFilter,
  DateRangeFilter,
  FieldByNameFilter,
  SchemaVariantFilter,
  TypeFilter,
} from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { noSchemaVersion, noValidSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Link } from '@tanstack/react-router';

const ExplorerPage_SchemaExplorerFragment = graphql(`
  fragment ExplorerPage_SchemaExplorerFragment on SchemaExplorer {
    query {
      ...GraphQLObjectTypeComponent_TypeFragment
    }
    mutation {
      ...GraphQLObjectTypeComponent_TypeFragment
    }
    subscription {
      ...GraphQLObjectTypeComponent_TypeFragment
    }
  }
`);

function SchemaView(props: {
  explorer: FragmentType<typeof ExplorerPage_SchemaExplorerFragment>;
  totalRequests: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const { query, mutation, subscription } = useFragment(
    ExplorerPage_SchemaExplorerFragment,
    props.explorer,
  );
  const { totalRequests } = props;

  return (
    <div className="flex flex-col gap-4">
      {query ? (
        <GraphQLObjectTypeComponent
          type={query}
          totalRequests={totalRequests}
          collapsed
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          warnAboutDeprecatedArguments={false}
          warnAboutUnusedArguments={false}
          styleDeprecated
        />
      ) : null}
      {mutation ? (
        <GraphQLObjectTypeComponent
          type={mutation}
          totalRequests={totalRequests}
          collapsed
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          warnAboutDeprecatedArguments={false}
          warnAboutUnusedArguments={false}
          styleDeprecated
        />
      ) : null}
      {subscription ? (
        <GraphQLObjectTypeComponent
          type={subscription}
          totalRequests={totalRequests}
          collapsed
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          warnAboutDeprecatedArguments={false}
          warnAboutUnusedArguments={false}
          styleDeprecated
        />
      ) : null}
    </div>
  );
}

const TargetExplorerPageQuery = graphql(`
  query TargetExplorerPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $period: DateRangeInput!
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
        explorer(usage: { period: $period }) {
          ...ExplorerPage_SchemaExplorerFragment
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

function ExplorerPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const { resolvedPeriod, dataRetentionInDays, setDataRetentionInDays } =
    useSchemaExplorerContext();
  const [query] = useQuery({
    query: TargetExplorerPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      period: resolvedPeriod,
    },
  });

  const currentOrganization = query.data?.organization?.organization;
  const retentionInDays = currentOrganization?.rateLimit.retentionInDays;

  useEffect(() => {
    if (typeof retentionInDays === 'number' && dataRetentionInDays !== retentionInDays) {
      setDataRetentionInDays(retentionInDays);
    }
  }, [setDataRetentionInDays, retentionInDays]);

  /* to avoid janky behaviour we keep track if the version has a successful explorer once, and in that case always show the filter bar. */
  const isFilterVisible = useRef(false);

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const currentTarget = query.data?.target;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;
  const latestValidSchemaVersion = currentTarget?.latestValidSchemaVersion;

  if (latestValidSchemaVersion?.explorer) {
    isFilterVisible.current = true;
  }

  return (
    <TargetLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      page={Page.Explorer}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Explore Schema</Title>
          <Subtitle>Insights from the latest version.</Subtitle>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          {isFilterVisible.current && (
            <>
              <TypeFilter
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
                period={resolvedPeriod}
              />
              <FieldByNameFilter />
              <DateRangeFilter />
              <ArgumentVisibilityFilter />
              <SchemaVariantFilter
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
                variant="all"
              />
            </>
          )}
        </div>
      </div>
      {!query.fetching && !query.stale && (
        <>
          {latestValidSchemaVersion?.explorer && latestSchemaVersion ? (
            <>
              {latestSchemaVersion.id !== latestValidSchemaVersion.id && (
                <Alert className="mb-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertTitle>Outdated Schema</AlertTitle>
                  <AlertDescription>
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
              <SchemaView
                totalRequests={query.data?.operationsStats.totalRequests ?? 0}
                explorer={latestValidSchemaVersion.explorer}
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
              />
            </>
          ) : latestSchemaVersion ? (
            noValidSchemaVersion
          ) : (
            noSchemaVersion
          )}
        </>
      )}
    </TargetLayout>
  );
}

export function TargetExplorerPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="Schema Explorer" />
      <SchemaExplorerProvider>
        <ExplorerPageContent {...props} />
      </SchemaExplorerProvider>
    </>
  );
}
