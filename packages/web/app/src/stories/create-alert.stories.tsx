import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateAlertModalContent } from '@/components/project/alerts/create-alert';
import { AlertType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const createAlertModalFormSchema = z.object({
  type: z.enum([AlertType.SchemaChangeNotifications]),
  target: z
    .string({
      required_error: 'Target is required',
    })
    .min(1, 'Must select target'),
  channel: z
    .string({
      required_error: 'Channel is required',
    })
    .min(1, 'Must select channel'),
});

type CreateAlertModalFormValues = z.infer<typeof createAlertModalFormSchema>;

const meta: Meta<typeof CreateAlertModalContent> = {
  title: 'Modals/Create Alert Modal',
  component: CreateAlertModalContent,
  argTypes: {
    channels: {
      control: {
        type: 'object',
      },
    },
    form: {
      control: {
        type: 'object',
      },
    },
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onSubmit: {
      action: 'onSubmit',
    },
    targets: {
      control: {
        type: 'object',
      },
    },
    toggleModalOpen: {
      action: 'toggleModalOpen',
    },
  },
};

export default meta;

type Story = StoryObj<typeof CreateAlertModalContent>;

const Template: StoryFn<typeof CreateAlertModalContent> = args => {
  const form = useForm<CreateAlertModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createAlertModalFormSchema),
    defaultValues: {
      type: AlertType.SchemaChangeNotifications,
      target: '',
      channel: '',
    },
  });
  return <CreateAlertModalContent {...args} form={form} />;
};

export const CreateAlert: Story = Template.bind({});
CreateAlert.args = {
  channels: [
    {
      id: '1',
      name: 'Alert Slack Channel',
      __typename: 'AlertSlackChannel',
      ' $fragmentName': 'CreateAlertModal_AlertChannelFragment_AlertSlackChannel_Fragment',
    },
    {
      id: '2',
      name: 'Alert Webhook Channel',
      __typename: 'AlertWebhookChannel',
      ' $fragmentName': 'CreateAlertModal_AlertChannelFragment_AlertWebhookChannel_Fragment',
    },
    {
      id: '3',
      name: 'Teams Webhook Channel',
      __typename: 'TeamsWebhookChannel',
      ' $fragmentName': 'CreateAlertModal_AlertChannelFragment_TeamsWebhookChannel_Fragment',
    },
  ],
  targets: [
    {
      __typename: 'Target',
      id: '1',
      cleanId: '1',
      name: 'Target 1',
      ' $fragmentName': 'CreateAlertModal_TargetFragmentFragment',
    },
    {
      __typename: 'Target',
      id: '2',
      cleanId: '2',
      name: 'Target 2',
      ' $fragmentName': 'CreateAlertModal_TargetFragmentFragment',
    },
    {
      __typename: 'Target',
      id: '3',
      cleanId: '3',
      name: 'Target 3',
      ' $fragmentName': 'CreateAlertModal_TargetFragmentFragment',
    },
  ],
  isOpen: true,
};

export const CreateAlertWithoutChannelsOrAlerts: Story = Template.bind({});
CreateAlertWithoutChannelsOrAlerts.args = {
  channels: [],
  targets: [],
  isOpen: true,
};
