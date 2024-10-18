import { ReactElement, useMemo } from 'react';
import { AlertCircleIcon, RefreshCw } from 'lucide-react';
import { useQuery } from 'urql';
import { Section } from '@/components/common';
import { GraphQLHighlight } from '@/components/common/GraphQLSDLBlock';
import { Page, TargetLayout } from '@/components/layouts/target';
import { ClientsFilterTrigger } from '@/components/target/insights/Filters';
import { OperationsStats } from '@/components/target/insights/Stats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DateRangePicker, presetLast1Day } from '@/components/ui/date-range-picker';
import { EmptyList } from '@/components/ui/empty-list';
import { Link } from '@/components/ui/link';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { useSearchParamsFilter } from '@/lib/hooks/use-search-params-filters';

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

  return <div>Loading...</div>;
}

const Operation_View_OperationBodyQuery = graphql(`
  query GraphQLOperationBody_GetOperationBodyQuery(
    $selector: TargetSelectorInput!
    $hash: String!
  ) {
    target(selector: $selector) {
      id
      operation(hash: $hash) {
        type
        ...GraphQLOperationBody_OperationFragment
      }
    }
  }
`);

function OperationView({
  organizationSlug,
  projectSlug,
  targetSlug,
  dataRetentionInDays,
  operationHash,
  operationName,
}: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  dataRetentionInDays: number;
  operationHash: string;
  operationName: string;
}): ReactElement {
  const dateRangeController = useDateRangeController({
    dataRetentionInDays,
    defaultPreset: presetLast1Day,
  });
  const [selectedClients, setSelectedClients] = useSearchParamsFilter<string[]>('clients', []);
  const operationsList = useMemo(() => [operationHash], [operationHash]);

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
    result.data?.target?.operation?.type !== 'query' &&
    result.data?.target?.operation?.type !== 'mutation';

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>{operationName}</Title>
          <Subtitle>Insights of individual GraphQL operation</Subtitle>
        </div>
        {!result.fetching && isNotNoQueryOrMutation === false && (
          <div className="flex justify-end gap-x-2">
            <ClientsFilterTrigger
              period={dateRangeController.resolvedRange}
              selected={selectedClients}
              onFilter={setSelectedClients}
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
              targetSlug={targetSlug}
            />
            <DateRangePicker
              validUnits={['y', 'M', 'w', 'd', 'h']}
              selectedRange={dateRangeController.selectedPreset.range}
              startDate={dateRangeController.startDate}
              align="end"
              onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
            />
            <Button variant="outline" onClick={() => dateRangeController.refreshResolvedRange()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {!result.fetching && isNotNoQueryOrMutation === false ? (
        <OperationsStats
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          targetSlug={targetSlug}
          period={dateRangeController.resolvedRange}
          dateRangeText={dateRangeController.selectedPreset.label}
          operationsFilter={operationsList}
          clientNamesFilter={selectedClients}
          mode="operation-page"
          resolution={dateRangeController.resolution}
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
      <div className="mt-12 w-full rounded-md border border-gray-800 bg-gray-900/50 p-5">
        <Section.Title>Operation body</Section.Title>
        <GraphQLOperationBody operation={result.data?.target?.operation ?? null} />
      </div>
    </>
  );
}

const OperationInsightsPageQuery = graphql(`
  query OperationInsightsPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        slug
        rateLimit {
          retentionInDays
        }
      }
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

function OperationInsightsContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  operationHash: string;
  operationName: string;
}) {
  const [query] = useQuery({
    query: OperationInsightsPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
    },
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const currentOrganization = query.data?.organization?.organization;
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      page={Page.Insights}
    >
      {currentOrganization ? (
        hasCollectedOperations ? (
          <OperationView
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            targetSlug={props.targetSlug}
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
            operationHash={props.operationHash}
            operationName={props.operationName}
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

export function TargetInsightsOperationPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  operationHash: string;
  operationName: string;
}) {
  return (
    <>
      <Meta title={`Operation ${props.operationName}`} />
      <OperationInsightsContent {...props} />
    </>
  );
}
