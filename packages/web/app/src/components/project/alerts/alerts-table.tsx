import { Checkbox, Table, TBody, Td, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';

export const AlertsTable_AlertFragment = graphql(`
  fragment AlertsTable_AlertFragment on Alert {
    id
    type
    channel {
      id
      name
      type
    }
    target {
      id
      cleanId
      name
    }
  }
`);

export function AlertsTable(props: {
  alerts: FragmentType<typeof AlertsTable_AlertFragment>[];
  isChecked: (alertId: string) => boolean;
  onCheckedChange: (alertId: string, checked: boolean) => void;
}) {
  const alerts = useFragment(AlertsTable_AlertFragment, props.alerts);

  return (
    <Table>
      <TBody>
        {alerts.map(alert => (
          <Tr key={alert.id}>
            <Td width="1">
              <Checkbox
                onCheckedChange={isChecked => {
                  props.onCheckedChange(alert.id, isChecked === true);
                }}
                checked={props.isChecked(alert.id)}
              />
            </Td>
            <Td>
              <span className="capitalize">{alert.type.replaceAll('_', ' ').toLowerCase()}</span>
            </Td>
            <Td>Channel: {alert.channel.name}</Td>
            <Td>Target: {alert.target.name}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
