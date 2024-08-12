import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateChannelModalContent } from '@/components/project/alerts/create-channel';
import { AlertChannelType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const createChannelModalFormSchema = z.object({
  channelName: z
    .string({
      required_error: 'Channel name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
  type: z.nativeEnum(AlertChannelType),
  slackChannel: z.string({
    required_error: 'Slack channel is required',
  }),
  endpoint: z.string({
    required_error: 'Endpoint is required',
  }),
});

type CreateChannelModalFormValues = z.infer<typeof createChannelModalFormSchema>;

const meta: Meta<typeof CreateChannelModalContent> = {
  title: 'Modals/Create Channel Modal',
  component: CreateChannelModalContent,
  argTypes: {
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
    isWebhookLike: {
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
  },
  args: {
    isOpen: true,
  },
};

export default meta;

type Story = StoryObj<typeof CreateChannelModalContent>;

const Template: StoryFn<typeof CreateChannelModalContent> = args => {
  const defaultValues: CreateChannelModalFormValues = {
    channelName: '',
    type: args.isWebhookLike ? AlertChannelType.Webhook : AlertChannelType.Slack,
    slackChannel: '',
    endpoint: '',
  };

  const form = useForm<CreateChannelModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createChannelModalFormSchema),
    defaultValues,
  });

  return <CreateChannelModalContent {...args} form={form} />;
};

export const CreateChannelSlack: Story = Template.bind({});
CreateChannelSlack.args = {
  isWebhookLike: false,
};

export const CreateChannelWebhook: Story = Template.bind({});
CreateChannelWebhook.args = {
  isWebhookLike: true,
};
