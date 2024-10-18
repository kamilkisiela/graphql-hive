import { ReactElement } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import {
  ClientsFilterTrigger,
  OperationsFilterTrigger,
} from '@/components/target/insights/Filters';
import { OperationsList } from '@/components/target/insights/List';
import { OperationsStats } from '@/components/target/insights/Stats';
import { Button } from '@/components/ui/button';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { EmptyList } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { graphql } from '@/gql';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { useSearchParamsFilter } from '@/lib/hooks/use-search-params-filters';

function OperationsView({
  organizationSlug,
  projectSlug,
  targetSlug,
  dataRetentionInDays,
}: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  dataRetentionInDays: number;
}): ReactElement {
  const [selectedOperations, setSelectedOperations] = useSearchParamsFilter<string[]>(
    'operations',
    [],
  );
  const [selectedClients, setSelectedClients] = useSearchParamsFilter<string[]>('clients', []);
  const dateRangeController = useDateRangeController({
    dataRetentionInDays,
    defaultPreset: presetLast7Days,
  });

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Insights</Title>
          <Subtitle>Observe GraphQL requests and see how the API is consumed.</Subtitle>
        </div>
        <div className="flex justify-end gap-x-4">
          <OperationsFilterTrigger
            organizationSlug={organizationSlug}
            projectSlug={projectSlug}
            targetSlug={targetSlug}
            period={dateRangeController.resolvedRange}
            selected={selectedOperations}
            onFilter={setSelectedOperations}
          />
          <ClientsFilterTrigger
            organizationSlug={organizationSlug}
            projectSlug={projectSlug}
            targetSlug={targetSlug}
            period={dateRangeController.resolvedRange}
            selected={selectedClients}
            onFilter={setSelectedClients}
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
      </div>
      <OperationsStats
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        period={dateRangeController.resolvedRange}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        dateRangeText={dateRangeController.selectedPreset.label}
        mode="operation-list"
        resolution={dateRangeController.resolution}
      />
      <OperationsList
        className="mt-12"
        period={dateRangeController.resolvedRange}
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
        targetSlug={targetSlug}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        selectedPeriod={dateRangeController.selectedPreset.range}
      />
    </>
  );
}

const TargetOperationsPageQuery = graphql(`
  query TargetOperationsPageQuery(
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

function TargetOperationsPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [query] = useQuery({
    query: TargetOperationsPageQuery,
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
          <OperationsView
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            targetSlug={props.targetSlug}
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
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

export function TargetInsightsPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="Insights" />
      <TargetOperationsPageContent {...props} />
    </>
  );
}
