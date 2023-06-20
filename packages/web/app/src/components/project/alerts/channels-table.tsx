import { Checkbox, Table, Tag, TBody, Td, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { AlertChannelType } from '@/gql/graphql';

export const ChannelsTable_AlertChannelFragment = graphql(`
  fragment ChannelsTable_AlertChannelFragment on AlertChannel {
    id
    name
    type
    ... on AlertSlackChannel {
      channel
    }
    ... on AlertWebhookChannel {
      endpoint
    }
  }
`);

export function ChannelsTable(props: {
  channels: FragmentType<typeof ChannelsTable_AlertChannelFragment>[];
  isChecked: (channelId: string) => boolean;
  onCheckedChange: (channelId: string, checked: boolean) => void;
}) {
  const channels = useFragment(ChannelsTable_AlertChannelFragment, props.channels);

  return (
    <Table>
      <TBody>
        {channels.map(channel => (
          <Tr key={channel.id}>
            <Td width="1">
              <Checkbox
                onCheckedChange={isChecked => {
                  props.onCheckedChange(channel.id, isChecked === true);
                }}
                checked={props.isChecked(channel.id)}
              />
            </Td>
            <Td>{channel.name}</Td>
            <Td className="text-xs truncate text-gray-400">
              {channel.__typename === 'AlertSlackChannel'
                ? channel.channel
                : channel.__typename === 'AlertWebhookChannel'
                ? channel.endpoint
                : ''}
            </Td>
            <Td>
              <Tag color={channel.type === AlertChannelType.Webhook ? 'green' : 'yellow'}>
                {channel.type}
              </Tag>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
