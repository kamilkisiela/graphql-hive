import { ReactElement, useState } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts/target';
import {
  ClientsFilterTrigger,
  OperationsFilterTrigger,
} from '@/components/target/operations/Filters';
import { OperationsList } from '@/components/target/operations/List';
import { OperationsStats } from '@/components/target/operations/Stats';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { EmptyList, MetaTitle, RadixSelect } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { withSessionProtection } from '@/lib/supertokens/guard';

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
  const {
    updateDateRangeByKey,
    dateRangeKey,
    displayDateRangeLabel,
    availableDateRangeOptions,
    dateRange,
    resolution,
  } = useDateRangeController({
    dataRetentionInDays,
  });

  return (
    <>
      <div className="py-6 flex flex-row items-center justify-between">
        <div>
          <Title>Operations</Title>
          <Subtitle>Observe GraphQL requests and see how the API is consumed.</Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <OperationsFilterTrigger
            period={dateRange}
            selected={selectedOperations}
            onFilter={setSelectedOperations}
          />
          <ClientsFilterTrigger
            period={dateRange}
            selected={selectedClients}
            onFilter={setSelectedClients}
          />
          <RadixSelect
            onChange={updateDateRangeByKey}
            defaultValue={dateRangeKey}
            options={availableDateRangeOptions.map(key => ({
              value: key,
              label: displayDateRangeLabel(key),
            }))}
          />
        </div>
      </div>
      <OperationsStats
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        period={dateRange}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        resolution={resolution}
        mode="operation-list"
      />
      <OperationsList
        className="mt-12"
        period={dateRange}
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        selectedPeriod={dateRangeKey}
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
      value="operations"
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

function OperationsPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Operations" />
      <TargetOperationsPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OperationsPage);
