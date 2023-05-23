import React, { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Tooltip } from '@/components/v2';
import { PulseIcon, UsersIcon } from '@/components/v2/icon';
import { Link } from '@/components/v2/link';
import { Markdown } from '@/components/v2/markdown';
import { FragmentType, graphql, useFragment } from '@/gql';
import { formatNumber, useRouteSelector } from '@/lib/hooks';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import * as P from '@radix-ui/react-popover';
import { TooltipProvider } from '@radix-ui/react-tooltip';
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
    <P.Root>
      <P.Trigger asChild>
        <button title="Description is available" className="text-gray-500 hover:text-white">
          <ChatBubbleIcon className="h-5 w-auto" />
        </button>
      </P.Trigger>
      <P.Content
        className="max-w-screen-sm rounded-md bg-gray-800 p-4 text-sm shadow-md"
        side="right"
        sideOffset={5}
      >
        <P.Arrow className="fill-current text-gray-800" />
        <Markdown content={props.description} />
      </P.Content>
    </P.Root>
  );
}

const SchemaExplorerUsageStats_UsageFragment = graphql(`
  fragment SchemaExplorerUsageStats_UsageFragment on SchemaCoordinateUsage {
    total
    isUsed
    usedByClients
  }
`);

export function SchemaExplorerUsageStats(props: {
  usage: FragmentType<typeof SchemaExplorerUsageStats_UsageFragment>;
  totalRequests: number;
}) {
  const usage = useFragment(SchemaExplorerUsageStats_UsageFragment, props.usage);
  const percentage = props.totalRequests ? (usage.total / props.totalRequests) * 100 : 0;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row items-center gap-2 text-xs ml-3">
        <div className="grow">
          <div className="text-center" title={`${usage.total} requests`}>
            {formatNumber(usage.total)}
          </div>
          <div
            title={`${percentage.toFixed(2)}% of all requests`}
            className="relative mt-1 w-full overflow-hidden rounded bg-orange-500/20"
            style={{ width: 50, height: 5 }}
          >
            <div className="h-full bg-orange-500" style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <Tooltip
          content={
            <>
              <div className="font-bold mb-1 text-lg">Field Usage</div>
              {usage.isUsed === false ? (
                <div>This field is currently not in use.</div>
              ) : (
                <ul>
                  <li>This field has been queried in {usage.total} requests.</li>
                  <li>{percentage.toFixed(2)}% of all requests use this field.</li>
                </ul>
              )}
            </>
          }
        >
          <div className="text-xl cursor-help">
            <PulseIcon className="h-6 w-auto" />
          </div>
        </Tooltip>

        <Tooltip
          content={
            <>
              <div className="font-bold mb-1 text-lg">Client Usage</div>

              {Array.isArray(usage.usedByClients) ? (
                <>
                  <div className="mb-2">This field is used by the following clients:</div>
                  <ul>
                    {usage.usedByClients.map(item => (
                      <li key={item} className="font-bold">
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div>This field is not used by any client.</div>
              )}
            </>
          }
        >
          <div className="text-xl p-1 cursor-help">
            <UsersIcon size={16} className="h-6 w-auto" />
          </div>
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
    isDeprecated
    deprecationReason
    usage {
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
    isDeprecated
    deprecationReason
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
  }
`);

const GraphQLInputFields_InputFieldFragment = graphql(`
  fragment GraphQLInputFields_InputFieldFragment on GraphQLInputField {
    name
    description
    type
    isDeprecated
    deprecationReason
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
  }
`);

const GraphQLTypeCard_SupergraphMetadataFragment = graphql(`
  fragment GraphQLTypeCard_SupergraphMetadataFragment on SupergraphMetadata {
    ...SupergraphMetadataList_SupergraphMetadataFragment
  }
`);

export function GraphQLTypeCard(
  props: React.PropsWithChildren<{
    kind: string;
    name: string;
    description?: string | null;
    implements?: string[];
    totalRequests?: number;
    usage?: FragmentType<typeof SchemaExplorerUsageStats_UsageFragment>;
    supergraphMetadata?: FragmentType<typeof GraphQLTypeCard_SupergraphMetadataFragment> | null;
  }>,
): ReactElement {
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
            <div className="font-semibold">{props.name}</div>
            {props.description ? <Description description={props.description} /> : null}
          </div>
        </div>
        {Array.isArray(props.implements) && props.implements.length > 0 ? (
          <div className="flex flex-row text-sm text-gray-500">
            <div className="mr-2">implements</div>
            <div className="flex flex-row gap-2">
              {props.implements.map(t => (
                <GraphQLTypeAsLink key={t} type={t} />
              ))}
            </div>
          </div>
        ) : null}
        {props.usage && typeof props.totalRequests !== 'undefined' ? (
          <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={props.usage} />
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
      <span className="ml-1">
        <span className="text-gray-400">(</span>
        <div className="pl-4">
          {args.map(arg => {
            return (
              <div key={arg.name}>
                {arg.name}
                {': '}
                <GraphQLTypeAsLink type={arg.type} />
                {arg.description ? <Description description={arg.description} /> : null}
              </div>
            );
          })}
        </div>
        <span className="text-gray-400">)</span>
      </span>
    );
  }

  return (
    <span className="ml-1">
      <span className="text-gray-400">(</span>
      <span className="space-x-2">
        {args.slice(0, 2).map(arg => {
          return (
            <span key={arg.name}>
              {arg.name}
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
      <span className="text-gray-400">)</span>
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
  fields: Array<FragmentType<typeof GraphQLFields_FieldFragment>>;
  totalRequests: number;
  collapsed?: boolean;
}) {
  const { totalRequests } = props;
  const [fields, collapsed, expand] = useCollapsibleList(
    useFragment(GraphQLFields_FieldFragment, props.fields),
    5,
    props.collapsed ?? false,
  );

  return (
    <div className="flex flex-col">
      {fields.map((field, i) => {
        return (
          <GraphQLTypeCardListItem key={field.name} index={i}>
            <div>
              {field.name}
              {field.args.length > 0 ? <GraphQLArguments args={field.args} /> : null}
              <span className="mr-1">:</span>
              <GraphQLTypeAsLink type={field.type} />
            </div>
            <div className="flex flex-row items-center">
              {field.supergraphMetadata ? (
                <div className="ml-1">
                  <SupergraphMetadataList supergraphMetadata={field.supergraphMetadata} />
                </div>
              ) : null}
              <SchemaExplorerUsageStats totalRequests={totalRequests} usage={field.usage} />
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
  );
}

export function GraphQLInputFields(props: {
  fields: FragmentType<typeof GraphQLInputFields_InputFieldFragment>[];
  totalRequests: number;
}): ReactElement {
  const fields = useFragment(GraphQLInputFields_InputFieldFragment, props.fields);
  return (
    <div className="flex flex-col">
      {fields.map((field, i) => {
        return (
          <GraphQLTypeCardListItem key={field.name} index={i}>
            <div>
              {field.name}
              <span className="mr-1">:</span>
              <GraphQLTypeAsLink type={field.type} />
            </div>
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={field.usage} />
          </GraphQLTypeCardListItem>
        );
      })}
    </div>
  );
}

function GraphQLTypeAsLink(props: { type: string }): ReactElement {
  const router = useRouteSelector();
  const typename = props.type.replace(/[[\]!]+/g, '');

  return (
    <Link
      className="text-orange-500"
      href={`/${router.organizationId}/${router.projectId}/${router.targetId}/explorer/${typename}`}
    >
      {props.type}
    </Link>
  );
}
