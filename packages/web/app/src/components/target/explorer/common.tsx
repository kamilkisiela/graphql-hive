import React from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { gql, DocumentType } from 'urql';
import * as Popover from '@radix-ui/react-popover';
import { VscCommentDiscussion } from 'react-icons/vsc';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Link } from '@/components/v2/link';
import { formatNumber } from '@/lib/hooks/use-formatted-number';
import { useArgumentListToggle } from './provider';

function Description(props: { description: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button title="Description is available" className="m-0 h-6 p-0 text-gray-500 hover:text-white">
          <VscCommentDiscussion className="w-full" />
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="max-w-screen-sm rounded-md bg-gray-800 p-4 text-sm shadow-md"
        side="right"
        sideOffset={5}
      >
        <Popover.Arrow className="fill-current text-gray-800" />
        {props.description}
      </Popover.Content>
    </Popover.Root>
  );
}

const GraphQLFields_FieldFragment = gql(/* GraphQL */ `
  fragment GraphQLFields_FieldFragment on GraphQLField {
    name
    description
    type
    isDeprecated
    deprecationReason
    usage {
      total
      isUsed
    }
    args {
      ...GraphQLArguments_ArgumentFragment
    }
  }
`);

const GraphQLArguments_ArgumentFragment = gql(/* GraphQL */ `
  fragment GraphQLArguments_ArgumentFragment on GraphQLArgument {
    name
    description
    type
    isDeprecated
    deprecationReason
    usage {
      total
      isUsed
    }
  }
`);

const GraphQLInputFields_InputFieldFragment = gql(/* GraphQL */ `
  fragment GraphQLInputFields_InputFieldFragment on GraphQLInputField {
    name
    description
    type
    isDeprecated
    deprecationReason
    usage {
      total
      isUsed
    }
  }
`);

export function GraphQLTypeCard(
  props: React.PropsWithChildren<{
    kind: string;
    name: string;
    description?: string | null;
    implements?: string[];
  }>
) {
  return (
    <div className="rounded-md border-2">
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
      </div>
      <div>{props.children}</div>
    </div>
  );
}

export function GraphQLArguments(props: { args: DocumentType<typeof GraphQLArguments_ArgumentFragment>[] }) {
  const { args } = props;
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
        <span className="text-gray-400">{'('}</span>
        <div className="pl-4">
          {props.args.map(arg => {
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
        <span className="text-gray-400">{')'}</span>
      </span>
    );
  }

  return (
    <span className="ml-1">
      <span className="text-gray-400">{'('}</span>
      <span className="space-x-2">
        {props.args.slice(0, 2).map(arg => {
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
      <span className="text-gray-400">{')'}</span>
    </span>
  );
}

function useCollapsibleList<T>(list: T[], max: number, defaultValue: boolean) {
  const [collapsed, setCollapsed] = React.useState(defaultValue === true && list.length > max ? true : false);
  const expand = React.useCallback(() => {
    setCollapsed(false);
  }, [setCollapsed]);
  const noop = React.useCallback(() => {}, []);

  if (collapsed) {
    return [list.slice(0, max), collapsed, expand] as const;
  }

  return [list, collapsed, noop] as const;
}

export function GraphQLFields(props: {
  fields: DocumentType<typeof GraphQLFields_FieldFragment>[];
  totalRequests: number;
  collapsed?: boolean;
}) {
  const { totalRequests } = props;
  const [fields, collapsed, expand] = useCollapsibleList(props.fields, 5, props.collapsed ?? false);

  return (
    <div className="flex flex-col">
      {fields.map((field, i) => {
        return (
          <div
            key={field.name}
            className={clsx(
              'flex flex-row items-center justify-between p-4 text-sm',
              i % 2 ? '' : 'bg-gray-900 bg-opacity-50'
            )}
          >
            <div>
              {field.name}
              {field.args.length > 0 ? <GraphQLArguments args={field.args} /> : null}
              <span className="mr-1">{':'}</span>
              <GraphQLTypeAsLink type={field.type} />
            </div>
            <div className="text-xs">
              <div className="font-semibold">Requested</div>
              <div>{formatNumber(field.usage.total)} times</div>
              <div
                className="relative mt-1 w-full overflow-hidden rounded bg-gray-800"
                style={{
                  height: 5,
                }}
              >
                <div
                  className="bg-orange-500 h-full"
                  style={{
                    width: `${totalRequests ? (field.usage.total / totalRequests) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      {collapsed ? (
        <div
          className={clsx(
            'flex cursor-pointer flex-row items-center justify-between p-4 text-sm font-semibold hover:bg-gray-800',
            fields.length % 2 ? '' : 'bg-gray-900 bg-opacity-50'
          )}
          onClick={expand}
        >
          Show {props.fields.length - fields.length} more fields
        </div>
      ) : null}
    </div>
  );
}

export function GraphQLInputFields({
  fields,
  totalRequests,
}: {
  fields: DocumentType<typeof GraphQLInputFields_InputFieldFragment>[];
  totalRequests: number;
}) {
  return (
    <div className="flex flex-col">
      {fields.map((field, i) => {
        return (
          <div
            key={field.name}
            className={clsx(
              'flex flex-row items-center justify-between p-4 text-sm',
              i % 2 ? '' : 'bg-gray-900 bg-opacity-50'
            )}
          >
            <div>
              {field.name}
              <span className="mr-1">{':'}</span>
              <GraphQLTypeAsLink type={field.type} />
            </div>
            <div className="text-xs">
              <div className="font-semibold">Requested</div>
              <div>{formatNumber(field.usage.total)} times</div>
              <div
                className="relative mt-1 w-full overflow-hidden rounded bg-gray-800"
                style={{
                  height: 5,
                }}
              >
                <div
                  className="bg-orange-500 h-full"
                  style={{
                    width: `${totalRequests ? (field.usage.total / totalRequests) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GraphQLTypeAsLink(props: { type: string }) {
  const router = useRouteSelector();
  const typename = props.type.replace(/[[\]!]+/g, '');

  return (
    <NextLink href={`/${router.organizationId}/${router.projectId}/${router.targetId}/explorer/${typename}`} passHref>
      <Link className="text-orange-500">{props.type}</Link>
    </NextLink>
  );
}
