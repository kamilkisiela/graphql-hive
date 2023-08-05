import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { formatISO, subDays, subHours, subMinutes } from 'date-fns';
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
import { withSessionProtection } from '@/lib/supertokens/guard';

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

const DateRange = {
  '90d': {
    resolution: 90,
    label: 'Last 90 days',
  },
  '60d': {
    resolution: 60,
    label: 'Last 60 days',
  },
  '30d': {
    resolution: 60,
    label: 'Last 30 days',
  },
  '14d': {
    resolution: 60,
    label: 'Last 14 days',
  },
  '7d': {
    resolution: 60,
    label: 'Last 7 days',
  },
  '1d': {
    resolution: 60,
    label: 'Last 24 hours',
  },
  '1h': {
    resolution: 60,
    label: 'Last hour',
  },
};

type PeriodKey = keyof typeof DateRange;

function isDayBasedPeriodKey<T extends PeriodKey>(
  periodKey: T,
): periodKey is Extract<T, `${number}d`> {
  return periodKey.endsWith('d');
}

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
  const router = useRouter();
  const [href, periodParam] = router.asPath.split('?');
  let selectedPeriod: PeriodKey =
    (new URLSearchParams(periodParam).get('period') as PeriodKey) ?? '1d';
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const availablePeriodOptions = useMemo<PeriodKey[]>(() => {
    return Object.keys(DateRange).filter(key => {
      const periodKey = key as PeriodKey;

      if (isDayBasedPeriodKey(periodKey)) {
        // Only show day based periods that are within the data retention period
        const daysBack = parseInt(periodKey.replace('d', ''), 10);
        return daysBack <= dataRetentionInDays;
      }

      return true;
    }) as PeriodKey[];
  }, [dataRetentionInDays]);

  if (!availablePeriodOptions.includes(selectedPeriod)) {
    selectedPeriod = '1d';
  }

  const period = useMemo(() => {
    const now = floorDate(new Date());
    const sub = selectedPeriod.endsWith('h') ? 'h' : selectedPeriod.endsWith('m') ? 'm' : 'd';

    const value = parseInt(selectedPeriod.replace(sub, ''));
    const from = formatISO(
      sub === 'h'
        ? subHours(now, value)
        : sub === 'm'
        ? subMinutes(now, value)
        : subDays(now, value),
    );
    const to = formatISO(now);

    return { from, to };
  }, [selectedPeriod, availablePeriodOptions]);

  const updatePeriod = useCallback(
    (value: string) => {
      void router.push(`${href}?period=${value}`);
    },
    [href, router],
  );

  return (
    <>
      <div className="py-6 flex flex-row items-center justify-between">
        <div>
          <Title>Versions</Title>
          <Subtitle>Recently published schemas.</Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <OperationsFilterTrigger
            period={period}
            selected={selectedOperations}
            onFilter={setSelectedOperations}
          />
          <ClientsFilterTrigger
            period={period}
            selected={selectedClients}
            onFilter={setSelectedClients}
          />
          <RadixSelect
            onChange={updatePeriod}
            defaultValue={selectedPeriod}
            options={availablePeriodOptions.map(key => ({
              value: key,
              label: DateRange[key].label,
            }))}
          />
        </div>
      </div>
      <OperationsStats
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        period={period}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
        resolution={DateRange[selectedPeriod].resolution}
      />
      <OperationsList
        className="mt-12"
        period={period}
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        operationsFilter={selectedOperations}
        clientNamesFilter={selectedClients}
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
