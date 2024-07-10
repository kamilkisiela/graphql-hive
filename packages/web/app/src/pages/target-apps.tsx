import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DocsLink, Spinner, TimeAgo } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Link } from '@tanstack/react-router';

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
  query TargetAppsViewQuery($targetSelector: TargetSelectorInput!, $after: String) {
    target(selector: $targetSelector) {
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
  query TargetAppsViewFetchMoreQuery($targetSelector: TargetSelectorInput!, $after: String!) {
    target(selector: $targetSelector) {
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
  organizationId: string;
  projectId: string;
  targetId: string;
  appDeployment: FragmentType<typeof AppTableRow_AppDeploymentFragment>;
}) {
  const appDeployment = useFragment(AppTableRow_AppDeploymentFragment, props.appDeployment);

  return (
    <TableRow>
      <TableCell>
        <Link
          className="font-mono text-xs font-bold"
          to="/$organizationId/$projectId/$targetId/apps/$appName/$appVersion"
          params={{
            organizationId: props.organizationId,
            projectId: props.projectId,
            targetId: props.targetId,
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

function TargetAppsView(props: { organizationId: string; projectId: string; targetId: string }) {
  const [data] = useQuery({
    query: TargetAppsViewQuery,
    variables: {
      targetSelector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
    },
  });
  const client = useClient();

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  return (
    <div className="flex flex-1 flex-col py-6">
      <SubPageLayoutHeader
        subPageTitle="App Deployments"
        description={
          <>
            <CardDescription>
              App deployments empower you to group your GraphQL operations by version and leverage
              granular app version statistics and persisted operations.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#cdn-access-tokens"
                className="text-gray-500 hover:text-gray-300"
              >
                Learn more about App Deployments
              </DocsLink>
            </CardDescription>
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
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
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
                      targetSelector: {
                        organization: props.organizationId,
                        project: props.projectId,
                        target: props.targetId,
                      },
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
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  return (
    <>
      <Meta title="App Deployments" />
      <TargetLayout
        targetId={props.targetId}
        projectId={props.projectId}
        organizationId={props.organizationId}
        page={Page.Apps}
      >
        <TargetAppsView
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
        />
      </TargetLayout>
    </>
  );
}
