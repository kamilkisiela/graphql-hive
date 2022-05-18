import React from 'react';
import 'twin.macro';
import { Table, Tbody, Tr, Td, Checkbox, Button } from '@chakra-ui/react';
import { useQuery, useMutation } from 'urql';
import {
  AlertFieldsFragment,
  AlertsDocument,
  DeleteAlertsDocument,
  AlertType,
} from '@/graphql';
import { Section } from '@/components/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { AlertCreatorTrigger } from './AlertCreator';

// Daily reports
// Schema Change Notifications
// Performance Alerts

const alertTypeMap = {
  [AlertType.SchemaChangeNotifications]: 'Schema Change Notifications',
};

const AlertRow: React.FC<{
  alert: AlertFieldsFragment;
  checked: string[];
  onCheck(id: string): void;
}> = ({ alert, checked, onCheck }) => {
  return (
    <Tr>
      <Td textAlign="left" tw="w-10">
        <Checkbox
          colorScheme="primary"
          defaultChecked={false}
          checked={checked.includes(alert.id)}
          onChange={() => onCheck(alert.id)}
        />
      </Td>
      <Td textAlign="left">{alertTypeMap[alert.type]}</Td>
      <Td textAlign="left">
        <span tw="text-gray-500 mr-3">Channel:</span>
        {alert.channel.name}
      </Td>
      <Td textAlign="right">
        <span tw="text-gray-500 mr-3">Target:</span>
        {alert.target.name}
      </Td>
    </Tr>
  );
};

export const Alerts: React.FC = () => {
  const router = useRouteSelector();
  const [checked, setChecked] = React.useState<string[]>([]);
  const onCheck = React.useCallback(
    (id: string) => {
      if (checked.includes(id)) {
        setChecked(checked.filter((i) => i !== id));
      } else {
        setChecked(checked.concat(id));
      }
    },
    [checked, setChecked]
  );
  const [query] = useQuery({
    query: AlertsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });
  const [mutation, mutate] = useMutation(DeleteAlertsDocument);
  const disabled = checked.length === 0 || mutation.fetching;

  return (
    <div>
      <div tw="flex flex-row justify-between items-center">
        <div>
          <Section.Title>Active Alerts</Section.Title>
          <Section.Subtitle>Alerts are sent over the Channels</Section.Subtitle>
        </div>
        <div>
          <Button
            colorScheme="red"
            size="sm"
            disabled={disabled}
            isLoading={mutation.fetching}
            onClick={() => {
              mutate({
                input: {
                  organization: router.organizationId,
                  project: router.projectId,
                  alerts: checked,
                },
              });
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      <div tw="pt-3">
        <Table size="sm">
          <Tbody>
            {query.data?.alerts?.map((alert) => {
              return (
                <AlertRow
                  key={alert.id}
                  onCheck={onCheck}
                  checked={checked}
                  alert={alert}
                />
              );
            })}
          </Tbody>
        </Table>
      </div>
      <div tw="text-left pt-6">
        <AlertCreatorTrigger />
      </div>
    </div>
  );
};
