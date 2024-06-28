import { useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import { useClient, useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyList } from '@/components/ui/empty-list';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DocsLink } from '@/components/v2';
import { graphql } from '@/gql';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Link } from '@tanstack/react-router';

const TargetAppsVersionQuery = graphql(`
  query TargetAppsVersionQuery(
    $targetSelector: TargetSelectorInput!
    $appName: String!
    $appVersion: String!
    $first: Int
    $after: String
  ) {
    target(selector: $targetSelector) {
      id
      appDeployment(appName: $appName, appVersion: $appVersion) {
        id
        name
        version
        documents(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              hash
              body
              operationNames
            }
          }
        }
      }
    }
  }
`);

export function TargetAppVersionPage(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  appName: string;
  appVersion: string;
}) {
  const [data] = useQuery({
    query: TargetAppsVersionQuery,
    variables: {
      targetSelector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
      appName: props.appName,
      appVersion: props.appVersion,
      first: 20,
      after: null,
    },
  });
  const client = useClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const title = data.data?.target?.appDeployment
    ? `${data.data.target.appDeployment.name}@${data.data.target.appDeployment.version}`
    : 'App Deployment';

  return (
    <>
      <Meta title={title} />
      <TargetLayout
        targetId={props.targetId}
        projectId={props.projectId}
        organizationId={props.organizationId}
        page={Page.Apps}
      >
        <div className="flex flex-1 flex-col py-6">
          <SubPageLayoutHeader
            title={`App Deployment: ${title}`}
            description={
              <>
                <CardDescription>
                  App deployments empower you to group your GraphQL operations by version and
                  leverage granular app version statistics and persisted operations.
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
          {!data.data?.target?.appDeployment?.documents?.edges.length ? (
            <EmptyList
              title="No documents have been uploaded for this app deployment"
              description="You can upload documents via the Hive CLI"
              docsUrl="/features/schema-registry#app-deplyments"
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Document Hash</TableHead>
                      <TableHead className="hidden sm:table-cell">Operation Names</TableHead>
                      <TableHead className="hidden text-end sm:table-cell">
                        Document Content
                      </TableHead>
                      <TableHead className="hidden sm:table-cell"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data?.target?.appDeployment.documents?.edges.map(edge => (
                      <TableRow>
                        <TableCell>
                          <span className="rounded bg-gray-800 p-1 font-mono text-sm">
                            {edge.node.hash}
                          </span>
                        </TableCell>
                        <TableCell>
                          {!edge.node.operationNames ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help italic">anonymous</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>The operation within the document has no name.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            edge.node.operationNames.map((name, index, all) => (
                              <>
                                <span className="rounded bg-gray-800 p-1 font-mono text-sm">
                                  {name}
                                </span>
                                {index < all.length - 1 && ', '}
                              </>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <span className="rounded bg-gray-800 p-1 font-mono text-sm">
                            {edge.node.body.length > 43
                              ? edge.node.body.substring(0, 43).replace(/\n/g, '\\n') + '...'
                              : edge.node.body}
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost">
                                <DotsHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link
                                  to="/$organizationId/$projectId/$targetId/laboratory"
                                  params={{
                                    organizationId: props.organizationId,
                                    projectId: props.projectId,
                                    targetId: props.targetId,
                                  }}
                                  search={{
                                    operationString: edge.node.body,
                                  }}
                                >
                                  Execute in Laboratory
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto mr-0 flex"
                  disabled={
                    !data?.data?.target?.appDeployment?.documents?.pageInfo?.hasNextPage ||
                    isLoadingMore
                  }
                  onClick={() => {
                    if (
                      data?.data?.target?.appDeployment?.documents?.pageInfo?.endCursor &&
                      data?.data?.target?.appDeployment?.documents?.pageInfo?.hasNextPage
                    ) {
                      setIsLoadingMore(true);
                      client
                        .query(TargetAppsVersionQuery, {
                          targetSelector: {
                            organization: props.organizationId,
                            project: props.projectId,
                            target: props.targetId,
                          },
                          appName: props.appName,
                          appVersion: props.appVersion,
                          first: 20,
                          after: data?.data?.target?.appDeployment?.documents.pageInfo?.endCursor,
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
                      <LoaderCircleIcon className="rotate mr-2 inline size-4 animate-spin" />{' '}
                      Loading
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </TargetLayout>
    </>
  );
}
