import React from 'react';
import 'twin.macro';
import { useQuery } from 'urql';

import { Select, Stack } from '@chakra-ui/react';
import { VscChevronDown } from 'react-icons/vsc';
import {
  HasCollectedOperationsDocument,
  ProjectFieldsFragment,
  TargetFieldsFragment,
  OrganizationFieldsFragment,
} from '@/graphql';
import { Page } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { TargetView } from '@/components/target/View';
import { OperationsList } from '@/components/target/operations/List';
import { OperationsStats } from '@/components/target/operations/Stats';
import { EmptyList } from '@/components/common/EmptyList';
import { OperationsFilterTrigger } from '@/components/target/operations/Filters';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { calculatePeriod, DATE_RANGE_OPTIONS, PeriodKey } from '@/components/common/TimeFilter';

const OperationsView: React.FC<{
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}> = ({ organization, project, target }) => {
  const router = useRouteSelector();
  const selectedPeriod: PeriodKey = (router.query.period as PeriodKey) ?? '1d';
  const [selectedOperations, setSelectedOperations] = React.useState<string[]>([]);

  const period = React.useMemo(() => calculatePeriod(selectedPeriod), [selectedPeriod]);
  const updatePeriod = React.useCallback(
    (ev: any) => {
      router.update({ period: ev.target.value });
    },
    [router.update]
  );

  return (
    <>
      <div tw="absolute top-7 right-4">
        <Stack direction="row" spacing={4}>
          <div>
            <OperationsFilterTrigger period={period} selected={selectedOperations} onFilter={setSelectedOperations} />
          </div>
          <div>
            <Select
              variant="filled"
              tw="cursor-pointer rounded-md"
              defaultValue={selectedPeriod}
              onChange={updatePeriod}
              iconSize="16"
              icon={<VscChevronDown />}
              size="sm"
            >
              {DATE_RANGE_OPTIONS.map(item => {
                return (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                );
              })}
            </Select>
          </div>
        </Stack>
      </div>
      <div>
        <OperationsStats
          organization={organization.cleanId}
          project={project.cleanId}
          target={target.cleanId}
          period={period}
          operationsFilter={selectedOperations}
        />
        <OperationsList
          tw="pt-12"
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

const OperationsViewGate: React.FC<{
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}> = ({ organization, project, target }) => {
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
      {result => {
        if (!result.data.hasCollectedOperations) {
          return (
            <EmptyList
              title="Hive is waiting for your first collected operation"
              description="You can collect usage of your GraphQL API with Hive Client"
              documentationLink={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/monitoring`}
            />
          );
        }

        return <OperationsView organization={organization} project={project} target={target} />;
      }}
    </DataWrapper>
  );
};

export default function TargetOperations() {
  return (
    <TargetView title="Operations">
      {({ organization, project, target }) => (
        <Page title="Operations" subtitle="Data collected based on operation executed against your GraphQL schema.">
          <OperationsViewGate organization={organization} project={project} target={target} />
        </Page>
      )}
    </TargetView>
  );
}
