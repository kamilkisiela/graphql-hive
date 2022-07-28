import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { gql, useQuery } from 'urql';
import { Autocomplete } from '@/components/v2/autocomplete';

const ExplorerSearch_AllTypes = gql(/* GraphQL */ `
  query ExplorerSearch_AllTypes($organization: ID!, $project: ID!, $target: ID!, $period: DateRangeInput!) {
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

export function ExplorerSearch({
  organization,
  project,
  target,
  period,
  typename,
}: {
  typename?: string;
  organization: {
    cleanId: string;
  };
  project: {
    cleanId: string;
  };
  target: {
    cleanId: string;
  };
  period: {
    to: string;
    from: string;
  };
}) {
  const [disabled, setDisabled] = useState(false);
  const router = useRouter();
  const [query] = useQuery({
    query: ExplorerSearch_AllTypes,
    variables: {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period,
    },
    requestPolicy: 'cache-first',
  });

  const allNamedTypes = query.data?.target?.latestSchemaVersion?.explorer.types ?? [];
  const types = useMemo(() => {
    if (allNamedTypes.length > 0) {
      return allNamedTypes.map(t => ({
        value: t.name,
        label: t.name,
      }));
    }

    return [];
  }, [allNamedTypes]);

  return (
    <Autocomplete
      placeholder="Search for a type"
      defaultValue={
        typename
          ? {
              value: typename,
              label: typename,
            }
          : null
      }
      options={types}
      onChange={option => {
        setDisabled(true);
        router.push(`/${organization.cleanId}/${project.cleanId}/${target.cleanId}/explorer/${option.value}`);
      }}
      loading={query.fetching}
      disabled={disabled}
    />
  );
}
