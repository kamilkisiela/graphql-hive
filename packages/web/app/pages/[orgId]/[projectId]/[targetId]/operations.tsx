import { ComponentProps, ReactElement, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import 'twin.macro';
import { Select, Stack } from '@chakra-ui/react';
import { formatISO, subDays, subHours, subMinutes } from 'date-fns';
import { VscChevronDown } from 'react-icons/vsc';
import { useQuery } from 'urql';

import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { OperationsFilterTrigger } from '@/components/target/operations/Filters';
import { OperationsList } from '@/components/target/operations/List';
import { OperationsStats } from '@/components/target/operations/Stats';
import { DataWrapper, EmptyList, Title } from '@/components/v2';
import {
  HasCollectedOperationsDocument,
  OrganizationFieldsFragment,
  ProjectFieldsFragment,
  TargetFieldsFragment,
} from '@/graphql';

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

const OperationsView = ({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}): ReactElement => {
  const router = useRouter();
  const [href, periodParam] = router.asPath.split('?');
  const selectedPeriod: PeriodKey = (new URLSearchParams(periodParam).get('period') as PeriodKey) ?? '1d';
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);

  const period = useMemo(() => {
    const now = floorDate(new Date());
    const sub = selectedPeriod.endsWith('h') ? 'h' : selectedPeriod.endsWith('m') ? 'm' : 'd';

    const value = parseInt(selectedPeriod.replace(sub, ''));
    const from = formatISO(
      sub === 'h' ? subHours(now, value) : sub === 'm' ? subMinutes(now, value) : subDays(now, value)
    );
    const to = formatISO(now);

    return { from, to };
  }, [selectedPeriod]);

  const updatePeriod = useCallback<Exclude<ComponentProps<'select'>['onChange'], undefined | null>>(
    ev => {
      router.push(`${href}?period=${ev.target.value}`);
    },
    [href, router]
  );

  return (
    <>
      <div className="absolute top-0 right-0">
        <Stack direction="row" spacing={4}>
          <div>
            <OperationsFilterTrigger period={period} selected={selectedOperations} onFilter={setSelectedOperations} />
          </div>
          <div>
            <Select
              variant="filled"
              className="cursor-pointer rounded-md"
              defaultValue={selectedPeriod}
              onChange={updatePeriod}
              iconSize="16"
              icon={<VscChevronDown />}
              size="sm"
            >
              {Object.entries(DateRange).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </Stack>
      </div>
      <div className="space-y-12">
        <OperationsStats
          organization={organization.cleanId}
          project={project.cleanId}
          target={target.cleanId}
          period={period}
          operationsFilter={selectedOperations}
        />
        <OperationsList
          className="pt-12"
          period={period}
          organization={organization.cleanId}
          project={project.cleanId}
          target={target.cleanId}
          operationsFilter={selectedOperations}
        />
      </div>
    </>
  );
};

const OperationsViewGate = ({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}): ReactElement => {
  const [query] = useQuery({
    query: HasCollectedOperationsDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
    },
  });

  return (
    <DataWrapper query={query}>
      {result =>
        result.data.hasCollectedOperations ? (
          <OperationsView organization={organization} project={project} target={target} />
        ) : (
          <EmptyList
            title="Hive is waiting for your first collected operation"
            description="You can collect usage of your GraphQL API with Hive Client"
            docsUrl={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/monitoring`}
          />
        )
      }
    </DataWrapper>
  );
};

function OperationsPage(): ReactElement {
  return (
    <>
      <Title title="Operations" />
      <TargetLayout value="operations">
        {({ organization, project, target }) => (
          <div className="relative">
            <p className="mb-5 font-light text-gray-500">
              Data collected based on operation executed against your GraphQL schema.
            </p>
            <OperationsViewGate organization={organization} project={project} target={target} />
          </div>
        )}
      </TargetLayout>
    </>
  );
}

export default authenticated(OperationsPage);
