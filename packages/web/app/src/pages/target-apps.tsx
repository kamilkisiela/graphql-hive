import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LoaderCircleIcon } from 'lucide-react';
import { useClient, useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { EmptyList, noSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TimeAgo } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Link, useRouter } from '@tanstack/react-router';

const AppTableRow_AppDeploymentFragment = graphql(`
  fragment AppTableRow_AppDeploymentFragment on AppDeployment {
    id
    name
    version
    status
    totalDocumentCount
    lastUsed
  }
`);

const TargetAppsViewQuery = graphql(`
  query TargetAppsViewQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $after: String
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        isAppDeploymentsEnabled
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
      latestSchemaVersion {
        id
        __typename
      }
      appDeployments(first: 20, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            ...AppTableRow_AppDeploymentFragment
          }
        }
      }
    }
  }
`);

const TargetAppsViewFetchMoreQuery = graphql(`
  query TargetAppsViewFetchMoreQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $after: String!
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      appDeployments(first: 20, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            ...AppTableRow_AppDeploymentFragment
          }
        }
      }
    }
  }
`);

function AppTableRow(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  appDeployment: FragmentType<typeof AppTableRow_AppDeploymentFragment>;
}) {
  const appDeployment = useFragment(AppTableRow_AppDeploymentFragment, props.appDeployment);

  return (
    <TableRow>
      <TableCell>
        <Link
          className="font-mono text-xs font-bold"
          to="/$organizationSlug/$projectSlug/$targetSlug/apps/$appName/$appVersion"
          params={{
            organizationSlug: props.organizationSlug,
            projectSlug: props.projectSlug,
            targetSlug: props.targetSlug,
            appName: appDeployment.name,
            appVersion: appDeployment.version,
          }}
        >
          {appDeployment.name}@{appDeployment.version}
        </Link>
      </TableCell>
      <TableCell className="hidden text-center sm:table-cell">
        <Badge className="text-xs" variant="secondary">
          {appDeployment.status}
        </Badge>
      </TableCell>
      <TableCell className="text-center">{appDeployment.totalDocumentCount}</TableCell>
      <TableCell className="text-end">
        {appDeployment.lastUsed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <TimeAgo date={appDeployment.lastUsed} className="cursor-help text-xs" />{' '}
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {'Last operation reported on '}
                  {format(appDeployment.lastUsed, 'dd.MM.yyyy')}
                  {' at '}
                  {format(appDeployment.lastUsed, 'HH:mm')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge className="cursor-help text-xs" variant="outline">
                  No data
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>There was no usage reported yet.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
    </TableRow>
  );
}

function TargetAppsView(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [data] = useQuery({
    query: TargetAppsViewQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
    },
  });
  const client = useClient();
  const router = useRouter();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isAppDeploymentsEnabled =
    !data.fetching && !data.stale && !data.data?.organization?.organization.isAppDeploymentsEnabled;

  useEffect(() => {
    if (isAppDeploymentsEnabled) {
      void router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug',
        params: {
          organizationSlug: props.organizationSlug,
          projectSlug: props.projectSlug,
          targetSlug: props.targetSlug,
        },
        replace: true,
      });
    }
  }, [isAppDeploymentsEnabled]);

  return (
    <div className="flex flex-1 flex-col py-6">
      <SubPageLayoutHeader
        subPageTitle="App Deployments"
        description={
          <>
            <CardDescription>
              Group your GraphQL operations by app version for app version statistics and persisted
              operations.
            </CardDescription>
            {/* <CardDescription>
              <DocsLink
                 href="/management/app-deployments"
                className="text-gray-500 hover:text-gray-300"
              >
                Learn more about App Deployments
              </DocsLink>
            </CardDescription> */}
          </>
        }
      />
      <div className="mt-4" />
      {data.fetching || data.stale ? (
        <div className="flex h-fit flex-1 items-center justify-center">
          <div className="flex flex-col items-center">
            <Spinner />
            <div className="mt-2 text-xs">Loading app deployments</div>
          </div>
        </div>
      ) : !data.data?.target?.latestSchemaVersion ? (
        noSchemaVersion
      ) : !data.data.target.appDeployments ? (
        <EmptyList
          title="Hive is waiting for your first app deployment"
          description="You can create an app deployment with the Hive CLI"
          docsUrl="/features/schema-registry#app-deplyments"
        />
      ) : (
        <div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">App@Version</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">Status</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">
                    Amount of Documents
                  </TableHead>
                  <TableHead className="hidden text-end sm:table-cell">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Last used</TooltipTrigger>
                        <TooltipContent className="max-w-64 text-start">
                          Last time a request was sent for this app. Requires usage reporting being
                          set up.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data?.target?.appDeployments?.edges.map(edge => (
                  <AppTableRow
                    organizationSlug={props.organizationSlug}
                    projectSlug={props.projectSlug}
                    targetSlug={props.targetSlug}
                    appDeployment={edge.node}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              className="ml-auto mr-0 flex"
              disabled={!data?.data?.target?.appDeployments?.pageInfo?.hasNextPage || isLoadingMore}
              onClick={() => {
                if (
                  data?.data?.target?.appDeployments?.pageInfo?.endCursor &&
                  data?.data?.target?.appDeployments?.pageInfo?.hasNextPage
                ) {
                  setIsLoadingMore(true);
                  void client
                    .query(TargetAppsViewFetchMoreQuery, {
                      organizationSlug: props.organizationSlug,
                      projectSlug: props.projectSlug,
                      targetSlug: props.targetSlug,
                      after: data?.data?.target?.appDeployments?.pageInfo?.endCursor,
                    })
                    .toPromise()
                    .finally(() => {
                      setIsLoadingMore(false);
                    });
                }
              }}
            >
              {isLoadingMore ? (
                <>
                  <LoaderCircleIcon className="mr-2 inline size-4 animate-spin" /> Loading
                </>
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TargetAppsPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="App Deployments" />
      <TargetLayout
        targetSlug={props.targetSlug}
        projectSlug={props.projectSlug}
        organizationSlug={props.organizationSlug}
        page={Page.Apps}
      >
        <TargetAppsView
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
        />
      </TargetLayout>
    </>
  );
}
