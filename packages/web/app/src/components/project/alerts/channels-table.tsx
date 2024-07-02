import { Checkbox, Table, Tag, TBody, Td, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { AlertChannelType, ChannelsTable_AlertChannelFragmentFragment } from '@/gql/graphql';

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
    ... on TeamsWebhookChannel {
      endpoint
    }
  }
`);

const colorMap = {
  [AlertChannelType.Slack]: 'green' as const,
  [AlertChannelType.Webhook]: 'yellow' as const,
  [AlertChannelType.MsteamsWebhook]: 'orange' as const,
};

export function ChannelsTable(props: {
  channels: FragmentType<typeof ChannelsTable_AlertChannelFragment>[];
  isChecked: (channelId: string) => boolean;
  onCheckedChange: (channelId: string, checked: boolean) => void;
}) {
  const channels = useFragment(ChannelsTable_AlertChannelFragment, props.channels);

  const renderChannelEndpoint = (channel: ChannelsTable_AlertChannelFragmentFragment) => {
    if (channel.__typename === 'AlertSlackChannel') {
      return channel.channel;
    }
    if (
      channel.__typename === 'AlertWebhookChannel' ||
      channel.__typename === 'TeamsWebhookChannel'
    ) {
      return channel.endpoint;
    }

    return '';
  };

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
            <Td className="truncate text-xs text-gray-400">{renderChannelEndpoint(channel)}</Td>
            <Td>
              <Tag color={colorMap[channel.type]}>{channel.type}</Tag>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
