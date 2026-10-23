import { ReactElement, useMemo } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import { RetentionNote } from '@/components/organization/billing/retention-note';
import { OperationsStats } from '@/components/target/insights/stats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateRangePicker, presetLast1Day } from '@/components/ui/date-range-picker';
import { EmptyList } from '@/components/ui/empty-list';
import { GraphQLHighlight } from '@/components/ui/graphql-block';
import { Link } from '@/components/ui/link';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Card } from '@/components/ui/primitives/card/card';
import { QueryError } from '@/components/ui/query-error';
import { RefreshButton } from '@/components/ui/refresh-button/refresh-button';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useSlugs } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { getRouteApi } from '@tanstack/react-router';

const operationRoute = getRouteApi(
  '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash',
);

const GraphQLOperationBody_OperationFragment = graphql(`
  fragment GraphQLOperationBody_OperationFragment on Operation {
    body
  }
`);

function GraphQLOperationBody(props: {
  operation: FragmentType<typeof GraphQLOperationBody_OperationFragment> | null;
}) {
  const operation = useFragment(GraphQLOperationBody_OperationFragment, props.operation);

  if (operation?.body) {
    return <GraphQLHighlight className="pt-6" code={operation.body} />;
  }

  return <div>Operation not found.</div>;
}

export const Operation_View_OperationBodyQuery = graphql(`
  query GraphQLOperationBody_GetOperationBodyQuery($selector: TargetSelectorInput!, $hash: ID!) {
    target(reference: { bySelector: $selector }) {
      id
      operation(hash: $hash) {
        type
        ...GraphQLOperationBody_OperationFragment
      }
    }
  }
`);

function OperationView({
  dataRetentionInDays,
  operationHash,
  operationName,
}: {
  dataRetentionInDays: number;
  operationHash: string;
  operationName: string;
}): ReactElement {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const dateRangeController = useDateRangeController({
    dataRetentionInDays,
    defaultPreset: presetLast1Day,
  });
  const { period, resolution } = operationRoute.useLoaderData();
  const operationFilter = useMemo(() => ({ operationIds: [operationHash] }), [operationHash]);

  const [result] = useQuery({
    query: Operation_View_OperationBodyQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
      hash: operationHash,
    },
  });

  const isNotNoQueryOrMutation =
    result.data?.target?.operation?.type !== 'QUERY' &&
    result.data?.target?.operation?.type !== 'MUTATION';

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>{operationName}</Title>
          <Subtitle>Insights of individual GraphQL operation</Subtitle>
        </div>
        {!result.fetching && isNotNoQueryOrMutation === false && (
          <div className="flex justify-end gap-x-2">
            <DateRangePicker
              selectedRange={dateRangeController.selectedPreset.range}
              startDate={dateRangeController.startDate}
              align="end"
              onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
              footer={
                <RetentionNote
                  retentionInDays={dateRangeController.retentionInDays}
                  subject={dateRangeController.subject}
                />
              }
            />
            <RefreshButton onClick={() => dateRangeController.refreshResolvedRange()} />
          </div>
        )}
      </div>
      {!result.fetching && isNotNoQueryOrMutation === false ? (
        <OperationsStats
          period={period}
          dateRangeText={dateRangeController.selectedPreset.label}
          filter={operationFilter}
          mode="operation-page"
          resolution={resolution}
        />
      ) : (
        <Alert>
          <AlertCircleIcon className="size-4" />
          <AlertTitle>No Subscription insights available yet.</AlertTitle>
          <AlertDescription>
            Hive is currently only collecting usage data for this operation. We are currently
            evaluating what kind of insights are useful for subscriptions.{' '}
            <Link variant="primary" href="https://github.com/graphql-hive/platform/issues/3290">
              Please reach out to us directly or via the GitHub issue
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
      <div className="mt-12 w-full">
        <Card variants={{ onSurface: 'raised', titleSize: 'large' }} title="Operation body">
          {result.fetching ? (
            <div>Loading...</div>
          ) : (
            <GraphQLOperationBody operation={result.data?.target?.operation ?? null} />
          )}
        </Card>
      </div>
    </>
  );
}

export const OperationInsightsPageQuery = graphql(`
  query OperationInsightsPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization: organizationBySlug(organizationSlug: $organizationSlug) {
      id
      slug
      usageRetentionInDays
    }
    hasCollectedOperations(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    )
  }
`);

function OperationInsightsContent(props: { operationHash: string; operationName: string }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: OperationInsightsPageQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
    },
  });

  if (query.error) {
    return (
      <QueryError
        organizationSlug={organizationSlug}
        error={query.error}
        showLogoutButton={false}
      />
    );
  }

  const currentOrganization = query.data?.organization;

  if (!currentOrganization) {
    return null;
  }

  if (!query.data?.hasCollectedOperations) {
    return (
      <div className="py-8">
        <EmptyList
          title="Hive is waiting for your first collected operation"
          description="You can collect usage of your GraphQL API with Hive Client"
          docsUrl="/schema-registry/usage-reporting"
        />
      </div>
    );
  }

  return (
    <OperationView
      dataRetentionInDays={currentOrganization.usageRetentionInDays}
      operationHash={props.operationHash}
      operationName={props.operationName}
    />
  );
}

export function TargetInsightsOperationPage(props: {
  operationHash: string;
  operationName: string;
}) {
  return (
    <>
      <Meta title={`Operation ${props.operationName}`} />
      <LayoutContent>
        <OperationInsightsContent
          operationHash={props.operationHash}
          operationName={props.operationName}
        />
      </LayoutContent>
    </>
  );
}
