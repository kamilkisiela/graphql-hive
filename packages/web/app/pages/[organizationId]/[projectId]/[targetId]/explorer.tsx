import { ReactElement, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircleIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { MetaTitle } from '@/components/v2';
import { noSchemaVersion, noValidSchemaVersion } from '@/components/v2/empty-list';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';

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
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
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
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
      {mutation ? (
        <GraphQLObjectTypeComponent
          type={mutation}
          totalRequests={totalRequests}
          collapsed
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
      {subscription ? (
        <GraphQLObjectTypeComponent
          type={subscription}
          totalRequests={totalRequests}
          collapsed
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
    </div>
  );
}

const TargetExplorerPageQuery = graphql(`
  query TargetExplorerPageQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $period: DateRangeInput!
  ) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        rateLimit {
          retentionInDays
        }
        cleanId
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      cleanId
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
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
        organization: $organizationId
        project: $projectId
        target: $targetId
        period: $period
      }
    ) {
      totalRequests
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function ExplorerPageContent() {
  const router = useRouteSelector();
  const { resolvedPeriod, dataRetentionInDays, setDataRetentionInDays } =
    useSchemaExplorerContext();
  const [query] = useQuery({
    query: TargetExplorerPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
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

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;
  const latestValidSchemaVersion = currentTarget?.latestValidSchemaVersion;

  /* to avoid janky behaviour we keep track if the version has a successful explorer once, and in that case always show the filter bar. */
  const isFilterVisible = useRef(false);

  if (latestValidSchemaVersion?.explorer) {
    isFilterVisible.current = true;
  }

  return (
    <TargetLayout
      page={Page.Explorer}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Explore</Title>
          <Subtitle>Insights from the latest version.</Subtitle>
        </div>
        {isFilterVisible.current && (
          <SchemaExplorerFilter
            organization={{ cleanId: router.organizationId }}
            project={{ cleanId: router.projectId }}
            target={{ cleanId: router.targetId }}
            period={resolvedPeriod}
          >
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
                Only unused
              </Link>
            </Button>
          </SchemaExplorerFilter>
        )}
      </div>
      {!query.fetching && (
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
                      href={{
                        pathname: '/[organizationId]/[projectId]/[targetId]/history/[versionId]',
                        query: {
                          organizationId: router.organizationId,
                          projectId: router.projectId,
                          targetId: router.targetId,
                          versionId: latestSchemaVersion.id,
                        },
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
                organizationCleanId={router.organizationId}
                projectCleanId={router.projectId}
                targetCleanId={router.targetId}
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

function ExplorerPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Schema Explorer" />
      <SchemaExplorerProvider>
        <ExplorerPageContent />
      </SchemaExplorerProvider>
    </>
  );
}

export default authenticated(ExplorerPage);
