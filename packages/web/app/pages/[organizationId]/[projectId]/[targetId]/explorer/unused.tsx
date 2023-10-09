import { memo, ReactElement, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetaTitle } from '@/components/v2';
import { EmptyList, noSchemaVersion } from '@/components/v2/empty-list';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { cn } from '@/lib/utils';
import { TypeRenderer, TypeRenderFragment } from './[typename]';

const UnusedSchemaView_UnusedSchemaExplorerFragment = graphql(`
  fragment UnusedSchemaView_UnusedSchemaExplorerFragment on UnusedSchemaExplorer {
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
      ...TypeRenderFragment
    }
  }
`);

const UnusedSchemaView = memo(function _UnusedSchemaView(props: {
  explorer: FragmentType<typeof UnusedSchemaView_UnusedSchemaExplorerFragment>;
  totalRequests: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const [selectedLetter, setSelectedLetter] = useState<string>();
  const { types } = useFragment(UnusedSchemaView_UnusedSchemaExplorerFragment, props.explorer);

  const typesGroupedByFirstLetter = useMemo(() => {
    const grouped = new Map<string, FragmentType<typeof TypeRenderFragment>[]>([]);

    for (const type of types) {
      const letter = type.name[0].toLocaleUpperCase();
      const existingNameGroup = grouped.get(letter);

      if (existingNameGroup) {
        existingNameGroup.push(type);
      } else {
        grouped.set(letter, [type]);
      }
    }
    return grouped;
  }, [types]);

  const letters = Array.from(typesGroupedByFirstLetter.keys()).sort();

  useEffect(() => {
    if (!selectedLetter) {
      setSelectedLetter(letters[0]);
    }
  }, [selectedLetter, setSelectedLetter]);

  if (types.length === 0) {
    return (
      <EmptyList
        title="No unused types"
        description="It looks like you are using all types in your schema"
      />
    );
  }

  if (!selectedLetter) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <TooltipProvider>
          {letters.map(letter => (
            <Tooltip key={letter} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setSelectedLetter(letter)}
                  variant={letter === selectedLetter ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'rounded-none px-2 py-1',
                    letter === selectedLetter
                      ? 'text-orange-500'
                      : 'hover:text-orange-500 text-gray-500',
                  )}
                  key={letter}
                >
                  {letter}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {typesGroupedByFirstLetter.get(letter)?.length ?? 0} types
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      <div className="flex flex-col gap-4">
        {(typesGroupedByFirstLetter.get(selectedLetter) ?? []).map((type, i) => {
          return (
            <TypeRenderer
              key={i}
              type={type}
              organizationCleanId={props.organizationCleanId}
              projectCleanId={props.projectCleanId}
              targetCleanId={props.targetCleanId}
            />
          );
        })}
      </div>
    </div>
  );
});

const UnusedSchemaExplorer_UnusedSchemaQuery = graphql(`
  query UnusedSchemaExplorer_UnusedSchemaQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $period: DateRangeInput!
  ) {
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
      latestSchemaVersion {
        __typename
        id
        valid
        unusedSchema(usage: { period: $period }) {
          ...UnusedSchemaView_UnusedSchemaExplorerFragment
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
  }
`);

function UnusedSchemaExplorer(props: {
  dataRetentionInDays: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const {
    updateDateRangeByKey,
    dateRangeKey,
    displayDateRangeLabel,
    availableDateRangeOptions,
    dateRange,
  } = useDateRangeController({
    dataRetentionInDays: props.dataRetentionInDays,
    minKey: '7d',
  });

  const [query] = useQuery({
    query: UnusedSchemaExplorer_UnusedSchemaQuery,
    variables: {
      organizationId: props.organizationCleanId,
      projectId: props.projectCleanId,
      targetId: props.targetCleanId,
      period: dateRange,
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const latestSchemaVersion = query.data?.target?.latestSchemaVersion;
  const explorer = latestSchemaVersion?.unusedSchema;

  return (
    <>
      <div className="py-6 flex flex-row items-center justify-between">
        <div>
          <Title>Unused Schema</Title>
          <Subtitle>
            Helps you understand the coverage of GraphQL schema and safely remove the unused part
          </Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <Select
            onValueChange={updateDateRangeByKey}
            defaultValue={dateRangeKey}
            disabled={query.fetching}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={displayDateRangeLabel(dateRangeKey)} />
            </SelectTrigger>
            <SelectContent>
              {availableDateRangeOptions.map(key => (
                <SelectItem key={key} value={key}>
                  {displayDateRangeLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.fetching ? null : latestSchemaVersion && explorer ? (
        <UnusedSchemaView
          totalRequests={query.data?.operationsStats.totalRequests ?? 0}
          explorer={explorer}
          organizationCleanId={props.organizationCleanId}
          projectCleanId={props.projectCleanId}
          targetCleanId={props.targetCleanId}
        />
      ) : (
        noSchemaVersion
      )}
    </>
  );
}

const TargetExplorerUnusedSchemaPageQuery = graphql(`
  query TargetExplorerUnusedSchemaPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
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
    hasCollectedOperations(
      selector: { organization: $organizationId, project: $projectId, target: $targetId }
    )
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function ExplorerUnusedSchemaPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetExplorerUnusedSchemaPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      page={Page.Explorer}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      {currentOrganization ? (
        hasCollectedOperations ? (
          <UnusedSchemaExplorer
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
            organizationCleanId={router.organizationId}
            projectCleanId={router.projectId}
            targetCleanId={router.targetId}
          />
        ) : (
          <div className="py-8">
            <EmptyList
              title="Hive is waiting for your first collected operation"
              description="You can collect usage of your GraphQL API with Hive Client"
              docsUrl="/features/usage-reporting"
            />
          </div>
        )
      ) : null}
    </TargetLayout>
  );
}

function UnusedSchemaExplorerPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Unused Schema Explorer" />
      <ExplorerUnusedSchemaPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(UnusedSchemaExplorerPage);
