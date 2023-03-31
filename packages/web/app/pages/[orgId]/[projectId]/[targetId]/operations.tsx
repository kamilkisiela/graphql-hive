import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { formatISO, subDays, subHours, subMinutes } from 'date-fns';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { OperationsFilterTrigger } from '@/components/target/operations/Filters';
import { OperationsList } from '@/components/target/operations/List';
import { OperationsStats } from '@/components/target/operations/Stats';
import { EmptyList, RadixSelect, Title } from '@/components/v2';
import { graphql } from '@/gql';
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
      <div className="flex justify-end gap-2 pb-7">
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
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
        cleanId
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
      cleanId
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      cleanId
    }
    hasCollectedOperations(
      selector: { organization: $organizationId, project: $projectId, target: $targetId }
    )
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function OperationsPage(): ReactElement {
  return (
    <>
      <Title title="Operations" />
      <TargetLayout value="operations" query={TargetOperationsPageQuery}>
        {({ organization, project, target, hasCollectedOperations }) =>
          organization && project && target ? (
            <div className="relative">
              {hasCollectedOperations ? (
                <OperationsView
                  organizationCleanId={organization.organization.cleanId}
                  projectCleanId={project.cleanId}
                  targetCleanId={target.cleanId}
                />
              ) : (
                <EmptyList
                  title="Hive is waiting for your first collected operation"
                  description="You can collect usage of your GraphQL API with Hive Client"
                  docsUrl="/features/usage-reporting"
                />
              )}
            </div>
          ) : null
        }
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OperationsPage);
