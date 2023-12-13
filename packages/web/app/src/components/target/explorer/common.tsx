import React, { ReactElement, ReactNode, useMemo } from 'react';
import NextLink from 'next/link';
import { clsx } from 'clsx';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PulseIcon, UsersIcon } from '@/components/v2/icon';
import { Markdown } from '@/components/v2/markdown';
import { FragmentType, graphql, useFragment } from '@/gql';
import { formatNumber, toDecimal, useRouteSelector } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useArgumentListToggle } from './provider';
import { SupergraphMetadataList } from './super-graph-metadata';

const noop = () => {};

function useCollapsibleList<T>(list: ReadonlyArray<T>, max: number, defaultValue: boolean) {
  const [collapsed, setCollapsed] = React.useState(defaultValue === true && list.length > max);
  const expand = React.useCallback(() => {
    setCollapsed(false);
  }, [setCollapsed]);

  if (collapsed) {
    return [list.slice(0, max), collapsed, expand] as const;
  }

  return [list, collapsed, noop] as const;
}

function Description(props: { description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button title="Description is available" className="text-gray-500 hover:text-white">
          <ChatBubbleIcon className="h-5 w-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-screen-sm rounded-md p-4 text-sm shadow-md"
        side="right"
        sideOffset={5}
      >
        <PopoverArrow />
        <Markdown content={props.description} />
      </PopoverContent>
    </Popover>
  );
}

const SchemaExplorerUsageStats_UsageFragment = graphql(`
  fragment SchemaExplorerUsageStats_UsageFragment on SchemaCoordinateUsage {
    total
    isUsed
    usedByClients
    topOperations(limit: 5) {
      count
      name
      hash
    }
  }
`);

export function SchemaExplorerUsageStats(props: {
  usage: FragmentType<typeof SchemaExplorerUsageStats_UsageFragment>;
  totalRequests: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const usage = useFragment(SchemaExplorerUsageStats_UsageFragment, props.usage);
  const percentage = props.totalRequests ? (usage.total / props.totalRequests) * 100 : 0;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="ml-3 flex flex-row items-center gap-2 text-xs">
        <div className="grow">
          <div className="text-center" title={`${usage.total} requests`}>
            {formatNumber(usage.total)}
          </div>
          <div
            title={`${toDecimal(percentage)}% of all requests`}
            className="relative z-0 mt-1 w-full min-w-[25px] overflow-hidden rounded bg-orange-500/20"
            style={{ width: 50, height: 5 }}
          >
            <div className="z-0 h-full bg-orange-500" style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <Tooltip>
          <TooltipContent>
            <div className="z-10">
              <div className="mb-1 text-lg font-bold">Field Usage</div>
              {usage.isUsed === false ? (
                <div>This field is currently not in use.</div>
              ) : (
                <div>
                  <ul>
                    <li>
                      This field has been queried in <strong>{formatNumber(usage.total)}</strong>{' '}
                      requests.
                    </li>
                    <li>
                      <strong>{toDecimal(percentage)}%</strong> of all requests use this field.
                    </li>
                  </ul>

                  {Array.isArray(usage.topOperations) ? (
                    <>
                      <table className="mt-4 table-auto">
                        <thead>
                          <tr>
                            <th className="p-2 pl-0 text-left">Top 5 Operations</th>
                            <th className="p-2 text-center">Reqs</th>
                            <th className="p-2 text-center">Of total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.topOperations.map(op => (
                            <tr key={op.hash}>
                              <td className="px-2 pl-0 text-left">
                                <NextLink
                                  className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                                  href={{
                                    pathname:
                                      '/[organizationId]/[projectId]/[targetId]/insights/[operationName]/[operationHash]',
                                    query: {
                                      organizationId: props.organizationCleanId,
                                      projectId: props.projectCleanId,
                                      targetId: props.targetCleanId,
                                      operationName: `${op.hash.substring(0, 4)}_${op.name}`,
                                      operationHash: op.hash,
                                    },
                                  }}
                                >
                                  {op.hash.substring(0, 4)}_{op.name}
                                </NextLink>
                              </td>
                              <td className="px-2 text-center font-bold">
                                {formatNumber(op.count)}
                              </td>
                              <td className="px-2 text-center font-bold">
                                {toDecimal((op.count / props.totalRequests) * 100)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </TooltipContent>
          <TooltipTrigger>
            <div className="cursor-help text-xl">
              <PulseIcon className="h-6 w-auto" />
            </div>
          </TooltipTrigger>
        </Tooltip>

        <Tooltip>
          <TooltipContent>
            <>
              <div className="mb-1 text-lg font-bold">Client Usage</div>

              {Array.isArray(usage.usedByClients) ? (
                <>
                  <div className="mb-2">This field is used by the following clients:</div>
                  <ul>
                    {usage.usedByClients.map(clientName => (
                      <li key={clientName} className="font-bold">
                        <NextLink
                          className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                          href={{
                            pathname:
                              '/[organizationId]/[projectId]/[targetId]/insights/client/[name]',
                            query: {
                              organizationId: props.organizationCleanId,
                              projectId: props.projectCleanId,
                              targetId: props.targetCleanId,
                              name: clientName,
                            },
                          }}
                        >
                          {clientName}
                        </NextLink>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div>This field is not used by any client.</div>
              )}
            </>
          </TooltipContent>
          <TooltipTrigger>
            <div className="cursor-help p-1 text-xl">
              <UsersIcon size={16} className="h-6 w-auto" />
            </div>
          </TooltipTrigger>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

const GraphQLFields_FieldFragment = graphql(`
  fragment GraphQLFields_FieldFragment on GraphQLField {
    name
    description
    type
    usage {
      total
      ...SchemaExplorerUsageStats_UsageFragment
    }
    args {
      ...GraphQLArguments_ArgumentFragment
    }
    supergraphMetadata {
      ...SupergraphMetadataList_SupergraphMetadataFragment
    }
  }
`);

const GraphQLArguments_ArgumentFragment = graphql(`
  fragment GraphQLArguments_ArgumentFragment on GraphQLArgument {
    name
    description
    type
  }
`);

const GraphQLInputFields_InputFieldFragment = graphql(`
  fragment GraphQLInputFields_InputFieldFragment on GraphQLInputField {
    name
    description
    type
    usage {
      total
      ...SchemaExplorerUsageStats_UsageFragment
    }
  }
`);

const GraphQLTypeCard_SupergraphMetadataFragment = graphql(`
  fragment GraphQLTypeCard_SupergraphMetadataFragment on SupergraphMetadata {
    ...SupergraphMetadataList_SupergraphMetadataFragment
  }
`);

export function GraphQLTypeCard(props: {
  kind: string;
  name: string;
  description?: string | null;
  implements?: string[];
  totalRequests?: number;
  usage?: FragmentType<typeof SchemaExplorerUsageStats_UsageFragment>;
  supergraphMetadata?: FragmentType<typeof GraphQLTypeCard_SupergraphMetadataFragment> | null;
  targetCleanId: string;
  projectCleanId: string;
  organizationCleanId: string;
  children: ReactNode;
}): ReactElement {
  const supergraphMetadata = useFragment(
    GraphQLTypeCard_SupergraphMetadataFragment,
    props.supergraphMetadata,
  );
  return (
    <div className="rounded-md border-2 border-gray-900">
      <div className="flex flex-row justify-between p-4">
        <div>
          <div className="flex flex-row items-center gap-2">
            <div className="font-normal text-gray-500">{props.kind}</div>
            <div className="font-semibold">
              <GraphQLTypeAsLink type={props.name} />
            </div>
            {props.description ? <Description description={props.description} /> : null}
          </div>
        </div>
        {Array.isArray(props.implements) && props.implements.length > 0 ? (
          <div className="flex flex-row items-center text-sm text-gray-500">
            <div className="mr-2">implements</div>
            <div className="flex flex-row gap-2">
              {props.implements.map(t => (
                <GraphQLTypeAsLink key={t} type={t} />
              ))}
            </div>
          </div>
        ) : null}
        {props.usage && typeof props.totalRequests !== 'undefined' ? (
          <SchemaExplorerUsageStats
            totalRequests={props.totalRequests}
            usage={props.usage}
            organizationCleanId={props.organizationCleanId}
            projectCleanId={props.projectCleanId}
            targetCleanId={props.targetCleanId}
          />
        ) : null}
        {supergraphMetadata ? (
          <SupergraphMetadataList supergraphMetadata={supergraphMetadata} />
        ) : null}
      </div>
      <div>{props.children}</div>
    </div>
  );
}

function GraphQLArguments(props: {
  parentCoordinate: string;
  args: FragmentType<typeof GraphQLArguments_ArgumentFragment>[];
}) {
  const args = useFragment(GraphQLArguments_ArgumentFragment, props.args);
  const [isCollapsedGlobally] = useArgumentListToggle();
  const [collapsed, setCollapsed] = React.useState(isCollapsedGlobally);
  const hasMoreThanTwo = args.length > 2;
  const showAll = hasMoreThanTwo && !collapsed;

  React.useEffect(() => {
    setCollapsed(isCollapsedGlobally);
  }, [isCollapsedGlobally, setCollapsed]);

  if (showAll) {
    return (
      <span className="ml-1 text-gray-500">
        <span>(</span>
        <div className="pl-4 text-gray-500">
          {args.map(arg => {
            const coordinate = `${props.parentCoordinate}.${arg.name}`;
            return (
              <div key={arg.name}>
                <LinkToCoordinatePage coordinate={coordinate}>{arg.name}</LinkToCoordinatePage>
                {': '}
                <GraphQLTypeAsLink type={arg.type} />
                {arg.description ? <Description description={arg.description} /> : null}
              </div>
            );
          })}
        </div>
        <span>)</span>
      </span>
    );
  }

  return (
    <span className="ml-1 text-gray-500">
      <span>(</span>
      <span className="space-x-2">
        {args.slice(0, 2).map(arg => {
          const coordinate = `${props.parentCoordinate}.${arg.name}`;
          return (
            <span key={arg.name}>
              <LinkToCoordinatePage coordinate={coordinate}>{arg.name}</LinkToCoordinatePage>
              {': '}
              <GraphQLTypeAsLink type={arg.type} />
            </span>
          );
        })}
        {hasMoreThanTwo ? (
          <span
            className="cursor-pointer rounded bg-gray-900 p-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={() => setCollapsed(prev => !prev)}
          >
            {props.args.length - 2} hidden
          </span>
        ) : null}
      </span>
      <span>)</span>
    </span>
  );
}

export function GraphQLTypeCardListItem(props: {
  children: ReactNode;
  index: number;
  className?: string;
  onClick?: () => void;
}): ReactElement {
  return (
    <div
      onClick={props.onClick}
      className={clsx(
        'flex flex-row items-center justify-between p-4 text-sm',
        props.index % 2 ? '' : 'bg-gray-900/50',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function GraphQLFields(props: {
  typeName: string;
  fields: Array<FragmentType<typeof GraphQLFields_FieldFragment>>;
  totalRequests?: number;
  collapsed?: boolean;
  targetCleanId: string;
  projectCleanId: string;
  organizationCleanId: string;
  filterValue?: string;
}) {
  const { totalRequests, filterValue } = props;
  const fieldsFromFragment = useFragment(GraphQLFields_FieldFragment, props.fields);
  const sortedAndFilteredFields = useMemo(
    () =>
      [...fieldsFromFragment]
        .filter(field => (filterValue ? field.name.includes(filterValue) : true))
        .sort(
          // Sort by usage DESC, name ASC
          (a, b) => b.usage.total - a.usage.total || a.name.localeCompare(b.name),
        ),
    [fieldsFromFragment, filterValue],
  );
  const [fields, collapsed, expand] = useCollapsibleList(
    sortedAndFilteredFields,
    5,
    props.collapsed ?? false,
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col">
        {fields.map((field, i) => {
          const coordinate = `${props.typeName}.${field.name}`;
          const isUsed = field.usage.total > 0;
          const hasUnusedArguments = field.args.length > 0;
          const showsUnusedSchema = typeof totalRequests !== 'number';

          return (
            <GraphQLTypeCardListItem key={field.name} index={i}>
              <div>
                {isUsed && hasUnusedArguments && showsUnusedSchema ? (
                  <Tooltip>
                    <TooltipContent>
                      This field is used but the presented arguments are not.
                    </TooltipContent>
                    <TooltipTrigger>
                      <span className="mr-1 text-sm text-orange-500">*</span>
                    </TooltipTrigger>
                  </Tooltip>
                ) : null}
                <LinkToCoordinatePage coordinate={coordinate} className="font-semibold">
                  {field.name}
                </LinkToCoordinatePage>
                {field.args.length > 0 ? (
                  <GraphQLArguments parentCoordinate={coordinate} args={field.args} />
                ) : null}
                <span className="mr-1">:</span>
                <GraphQLTypeAsLink className="font-semibold text-gray-400" type={field.type} />
              </div>
              <div className="flex flex-row items-center">
                {field.supergraphMetadata ? (
                  <div className="ml-1">
                    <SupergraphMetadataList supergraphMetadata={field.supergraphMetadata} />
                  </div>
                ) : null}
                {typeof totalRequests === 'number' ? (
                  <SchemaExplorerUsageStats
                    totalRequests={totalRequests}
                    usage={field.usage}
                    targetCleanId={props.targetCleanId}
                    projectCleanId={props.projectCleanId}
                    organizationCleanId={props.organizationCleanId}
                  />
                ) : null}
              </div>
            </GraphQLTypeCardListItem>
          );
        })}
        {collapsed ? (
          <GraphQLTypeCardListItem
            index={fields.length}
            className="cursor-pointer font-semibold hover:bg-gray-800"
            onClick={expand}
          >
            Show {props.fields.length - fields.length} more fields
          </GraphQLTypeCardListItem>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

export function GraphQLInputFields(props: {
  typeName: string;
  fields: FragmentType<typeof GraphQLInputFields_InputFieldFragment>[];
  totalRequests?: number;
  targetCleanId: string;
  projectCleanId: string;
  organizationCleanId: string;
}): ReactElement {
  const fields = useFragment(GraphQLInputFields_InputFieldFragment, props.fields);

  return (
    <div className="flex flex-col">
      {fields.map((field, i) => {
        const coordinate = `${props.typeName}.${field.name}`;
        return (
          <GraphQLTypeCardListItem key={field.name} index={i}>
            <div className="text-gray-400">
              <LinkToCoordinatePage coordinate={coordinate} className="font-semibold text-white">
                {field.name}
              </LinkToCoordinatePage>
              <span className="mr-1">:</span>
              <GraphQLTypeAsLink className="font-semibold" type={field.type} />
            </div>
            {typeof props.totalRequests === 'number' ? (
              <SchemaExplorerUsageStats
                totalRequests={props.totalRequests}
                usage={field.usage}
                targetCleanId={props.targetCleanId}
                projectCleanId={props.projectCleanId}
                organizationCleanId={props.organizationCleanId}
              />
            ) : null}
          </GraphQLTypeCardListItem>
        );
      })}
    </div>
  );
}

function GraphQLTypeAsLink(props: { type: string; className?: string }): ReactElement {
  const router = useRouteSelector();
  const typename = props.type.replace(/[[\]!]+/g, '');

  return (
    <Popover>
      <PopoverTrigger className={cn('hover:underline hover:underline-offset-4', props.className)}>
        {props.type}
      </PopoverTrigger>
      <PopoverContent side="right">
        <div className="flex flex-col gap-y-2">
          <p>
            <NextLink
              className="text-sm font-normal hover:underline hover:underline-offset-2"
              href={{
                pathname: '/[organizationId]/[projectId]/[targetId]/explorer/[typename]',
                query: {
                  organizationId: router.organizationId,
                  projectId: router.projectId,
                  targetId: router.targetId,
                  typename,
                  ...(router.query.period ? { period: router.query.period } : {}),
                },
              }}
            >
              Visit in <span className="font-bold">Explorer</span>
            </NextLink>
            <span className="text-xs text-gray-500"> - displays a full type</span>
          </p>
          <p>
            <NextLink
              className="text-sm font-normal hover:underline hover:underline-offset-2"
              href={{
                pathname:
                  '/[organizationId]/[projectId]/[targetId]/insights/schema-coordinate/[typename]',
                query: {
                  organizationId: router.organizationId,
                  projectId: router.projectId,
                  targetId: router.targetId,
                  typename,
                  ...(router.query.period ? { period: router.query.period } : {}),
                },
              }}
            >
              Visit in <span className="font-bold">Insights</span>
            </NextLink>
            <span className="text-xs text-gray-500"> - usage insights</span>
          </p>
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
}

export function LinkToCoordinatePage(props: {
  coordinate: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const router = useRouteSelector();

  return (
    <NextLink
      className={cn('hover:underline hover:underline-offset-2', props.className)}
      href={{
        pathname:
          '/[organizationId]/[projectId]/[targetId]/insights/schema-coordinate/[coordinate]',
        query: {
          organizationId: router.organizationId,
          projectId: router.projectId,
          targetId: router.targetId,
          coordinate: props.coordinate,
          ...(router.query.period ? { period: router.query.period } : {}),
        },
      }}
    >
      {props.children}
    </NextLink>
  );
}
