import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'urql';
import { Autocomplete, RadixSelect, SelectOption, Switch } from '@/components/v2';
import { graphql } from '@/gql';
import { useArgumentListToggle, usePeriodSelector } from './provider';

const SchemaExplorerFilter_AllTypes = graphql(`
  query SchemaExplorerFilter_AllTypes(
    $organization: ID!
    $project: ID!
    $target: ID!
    $period: DateRangeInput!
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      __typename
      id
      latestSchemaVersion {
        __typename
        id
        valid
        explorer(usage: { period: $period }) {
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
          }
        }
      }
    }
  }
`);

export function SchemaExplorerFilter({
  organization,
  project,
  target,
  period,
  typename,
}: {
  typename?: string;
  organization: { cleanId: string };
  project: { cleanId: string };
  target: { cleanId: string };
  period: {
    to: string;
    from: string;
  };
}) {
  const [collapsed, toggleCollapsed] = useArgumentListToggle();
  const router = useRouter();
  const [query] = useQuery({
    query: SchemaExplorerFilter_AllTypes,
    variables: {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period,
    },
    requestPolicy: 'cache-first',
  });
  const periodSelector = usePeriodSelector();

  const allNamedTypes = query.data?.target?.latestSchemaVersion?.explorer.types;
  const types = useMemo<SelectOption[]>(
    () =>
      allNamedTypes?.map(t => ({
        value: t.name,
        label: t.name,
      })) || [],
    [allNamedTypes],
  );

  return (
    <div className="flex flex-row items-center gap-x-4">
      <Autocomplete
        className="grow min-w-[250px] cursor-text"
        placeholder="Search for a type"
        defaultValue={typename ? { value: typename, label: typename } : null}
        options={types}
        onChange={option => {
          void router.push(
            `/${organization.cleanId}/${project.cleanId}/${target.cleanId}/explorer/${option.value}`,
          );
        }}
        loading={query.fetching}
      />
      <RadixSelect placeholder="Select a date range" {...periodSelector} />
      <div className="flex flex-row items-center gap-4">
        <Switch checked={!collapsed} onCheckedChange={toggleCollapsed} />
        <div className="cursor-default">
          <div>Show all arguments</div>
          <p className="text-xs text-gray-500">List of arguments is collapsed by default</p>
        </div>
      </div>
    </div>
  );
}
