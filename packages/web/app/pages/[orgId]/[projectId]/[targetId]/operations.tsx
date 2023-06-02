import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { formatISO, subDays, subHours, subMinutes } from 'date-fns';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts/target';
import { OperationsFilterTrigger } from '@/components/target/operations/Filters';
import { OperationsList } from '@/components/target/operations/List';
import { OperationsStats } from '@/components/target/operations/Stats';
import { EmptyList, RadixSelect, Title } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
import { withSessionProtection } from '@/lib/supertokens/guard';

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

const DateRange = {
  '30d': 'Last 30 days',
  '14d': 'Last 14 days',
  '7d': 'Last 7 days',
  '1d': 'Last 24 hours',
  '1h': 'Last hour',
};

type PeriodKey = keyof typeof DateRange;

function OperationsView({
  organizationCleanId,
  projectCleanId,
  targetCleanId,
}: {
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}): ReactElement {
  const router = useRouter();
  const [href, periodParam] = router.asPath.split('?');
  const selectedPeriod: PeriodKey =
    (new URLSearchParams(periodParam).get('period') as PeriodKey) ?? '1d';
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);

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
  }, [selectedPeriod]);

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
          <h3 className="text-lg font-semibold tracking-tight">Versions</h3>
          <p className="text-sm text-gray-400">Recently published schemas.</p>
        </div>
        <div className="flex justify-end gap-x-2">
          <OperationsFilterTrigger
            period={period}
            selected={selectedOperations}
            onFilter={setSelectedOperations}
          />
          <RadixSelect
            onChange={updatePeriod}
            defaultValue={selectedPeriod}
            options={Object.entries(DateRange).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>
      <OperationsStats
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        period={period}
        operationsFilter={selectedOperations}
      />
      <OperationsList
        className="mt-12"
        period={period}
        organization={organizationCleanId}
        project={projectCleanId}
        target={targetCleanId}
        operationsFilter={selectedOperations}
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
  useNotFoundRedirectOnError(!!query.error);

  if (query.error) {
    return null;
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
      className="flex justify-between gap-8"
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="grow">
        {currentOrganization && currentProject && currentTarget ? (
          hasCollectedOperations ? (
            <OperationsView
              organizationCleanId={currentOrganization.cleanId}
              projectCleanId={currentProject.cleanId}
              targetCleanId={currentTarget.cleanId}
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
      </div>
    </TargetLayout>
  );
}

function OperationsPage(): ReactElement {
  return (
    <>
      <Title title="Operations" />
      <TargetOperationsPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OperationsPage);
