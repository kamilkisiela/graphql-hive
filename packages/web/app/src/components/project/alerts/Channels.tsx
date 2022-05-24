import React from 'react';
import tw, { styled } from 'twin.macro';
import { useQuery, useMutation } from 'urql';
import { Label, Section } from '@/components/common';
import { Button, Table, Tbody, Tr, Td, Checkbox } from '@chakra-ui/react';
import {
  AlertChannelsDocument,
  DeleteAlertChannelsDocument,
  AlertChannelType,
  AlertSlackChannelFieldsFragment,
  AlertWebhookChannelFieldsFragment,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { ChannelCreatorTrigger } from './ChannelCreator';

export const ChannelLabel = styled(Label)(({ channel }: { channel: AlertChannelType }) => [
  channel === 'SLACK' && tw` background-color[#EBFAF3] color[#2EB67D] `,
  // channel === 'DISCORD' && tw` background-color[#E7E9FD] color[#5865F2] `,
  tw`lowercase`,
]);

const ChannelRow: React.FC<{
  channel: AlertSlackChannelFieldsFragment | AlertWebhookChannelFieldsFragment;
  checked: string[];
  onCheck(id: string): void;
}> = ({ channel, checked, onCheck }) => {
  return (
    <Tr>
      <Td tw="w-10">
        <Checkbox
          colorScheme="primary"
          defaultChecked={false}
          checked={checked.includes(channel.id)}
          onChange={() => onCheck(channel.id)}
        />
      </Td>
      <Td>{channel.name}</Td>
      <Td textAlign="right">
        <ChannelLabel channel={channel.type}>{channel.type}</ChannelLabel>
      </Td>
    </Tr>
  );
};

export const Channels: React.FC = () => {
  const router = useRouteSelector();
  const [checked, setChecked] = React.useState<string[]>([]);
  const onCheck = React.useCallback(
    (id: string) => {
      if (checked.includes(id)) {
        setChecked(checked.filter(i => i !== id));
      } else {
        setChecked(checked.concat(id));
      }
    },
    [checked, setChecked]
  );
  const [query] = useQuery({
    query: AlertChannelsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });
  const [mutation, mutate] = useMutation(DeleteAlertChannelsDocument);
  const disabled = checked.length === 0 || mutation.fetching;

  return (
    <div>
      <div tw="flex flex-row justify-between items-center">
        <div>
          <Section.Title>Available Channels</Section.Title>
          <Section.Subtitle>Channel represents a form of communication</Section.Subtitle>
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
                  channels: checked,
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
            {query.data?.alertChannels.map(channel => {
              return <ChannelRow key={channel.id} onCheck={onCheck} checked={checked} channel={channel} />;
            })}
          </Tbody>
        </Table>
      </div>
      <div tw="text-left pt-6">
        <ChannelCreatorTrigger />
      </div>
    </div>
  );
};
