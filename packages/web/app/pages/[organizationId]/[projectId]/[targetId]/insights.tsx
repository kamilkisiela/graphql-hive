import { ReactElement, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import {
  ClientsFilterTrigger,
  OperationsFilterTrigger,
} from '@/components/target/insights/Filters';
import { OperationsList } from '@/components/target/insights/List';
import { OperationsStats } from '@/components/target/insights/Stats';
import { Button } from '@/components/ui/button';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { EmptyList, MetaTitle } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';

function OperationsView({
  organizationCleanId,
  projectCleanId,
  targetCleanId,
  dataRetentionInDays,
}: {
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
  dataRetentionInDays: number;
}): ReactElement {
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
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
            period={dateRangeController.resolvedRange}
            selected={selectedOperations}
            onFilter={setSelectedOperations}
          />
          <ClientsFilterTrigger
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
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
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
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        selectedPeriod={dateRangeController.selectedPreset.range}
      />
    </>
  );
}

const TargetOperationsPageQuery = graphql(`
  query TargetOperationsPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        cleanId
        rateLimit {
          retentionInDays
        }
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      cleanId
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
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

function TargetOperationsPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetOperationsPageQuery,
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
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      page={Page.Insights}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      {currentOrganization && currentProject && currentTarget ? (
        hasCollectedOperations ? (
          <OperationsView
            organizationCleanId={currentOrganization.cleanId}
            projectCleanId={currentProject.cleanId}
            targetCleanId={currentTarget.cleanId}
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

function InsightsPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Insights" />
      <TargetOperationsPageContent />
    </>
  );
}

export default authenticated(InsightsPage);
