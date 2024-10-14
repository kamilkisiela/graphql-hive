import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CreateChannelModalContent,
  createChannelSchema,
} from '@/components/project/alerts/create-channel';
import { AlertChannelType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

type CreateChannelModalFormValues = z.infer<typeof createChannelSchema>;

const meta: Meta<typeof CreateChannelModalContent> = {
  title: 'Modals/Create Channel Modal',
  component: CreateChannelModalContent,
  argTypes: {
    form: {
      control: {
        type: 'object',
      },
    },
    userHasSlackIntegration: {
      control: {
        type: 'boolean',
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
    toggleModalOpen: {
      action: 'toggleModalOpen',
    },
    hasIntegrationAccess: {
      control: {
        type: 'boolean',
      },
    },
    isWebhook: {
      control: {
        type: 'boolean',
      },
    },

    organizationId: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    isOpen: true,
    hasIntegrationAccess: true,
    userHasSlackIntegration: true,
    organizationId: 'org-id',
  },
};

export default meta;

type Story = StoryObj<typeof CreateChannelModalContent>;

const Template: StoryFn<typeof CreateChannelModalContent> = args => {
  const defaultValues: CreateChannelModalFormValues = {
    channelName: '',
    type: args.isWebhook
      ? AlertChannelType.Webhook || AlertChannelType.MsteamsWebhook
      : AlertChannelType.Slack,
    slackChannel: '',
    endpoint: '',
  };

  const form = useForm<CreateChannelModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createChannelSchema),
    defaultValues,
  });

  useEffect(() => {
    const type = form.watch().type;
    if (type === AlertChannelType.Slack) {
      args.isWebhook = false;
    } else {
      args.isWebhook = true;
    }
  }, [form.watch().type, args.userHasSlackIntegration]);
  return <CreateChannelModalContent {...args} form={form} />;
};

export const Slack: Story = Template.bind({});
Slack.args = {
  isWebhook: false,
};

export const Webhook: Story = Template.bind({});
Webhook.args = {
  isWebhook: true,
};

export const NoSlackIntegration: Story = Template.bind({});
NoSlackIntegration.args = {
  isWebhook: true,
  userHasSlackIntegration: false,
  hasIntegrationAccess: false,
};

export const NoSlackIntegrationAndNoAccess: Story = Template.bind({});
NoSlackIntegrationAndNoAccess.args = {
  isWebhook: true,
  userHasSlackIntegration: false,
  hasIntegrationAccess: true,
  organizationId: 'org-id',
};
