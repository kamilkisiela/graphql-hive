import { ReactElement } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocsLink } from '@/components/ui/docs-note';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Tag } from '@/components/v2';
import { graphql } from '@/gql';
import { AlertChannelType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';

export const CreateChannel_AddAlertChannelMutation = graphql(`
  mutation CreateChannel_AddAlertChannel($input: AddAlertChannelInput!) {
    addAlertChannel(input: $input) {
      ok {
        updatedProject {
          id
        }
        addedAlertChannel {
          ...ChannelsTable_AlertChannelFragment
        }
      }
      error {
        message
        inputErrors {
          webhookEndpoint
          slackChannel
          name
        }
      }
    }
  }
`);

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

export const CreateChannelModal = ({
  isOpen,
  toggleModalOpen,
  organizationId,
  projectId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
}): ReactElement => {
  const [, mutate] = useMutation(CreateChannel_AddAlertChannelMutation);
  const { toast } = useToast();

  const form = useForm<CreateChannelModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createChannelModalFormSchema),
    defaultValues: {
      channelName: '',
      type: AlertChannelType.Slack,
      slackChannel: '',
      endpoint: '',
    },
  });

  const isWebhookLike = [AlertChannelType.Webhook, AlertChannelType.MsteamsWebhook].includes(
    form.getValues().type,
  );

  async function onSubmit(values: CreateChannelModalFormValues) {
    if (values.type === AlertChannelType.Slack && !values.slackChannel) {
      form.setError('slackChannel', { message: 'Slack channel is required' });
      return;
    }
    if (
      values.type === AlertChannelType.Slack &&
      !values.slackChannel.startsWith('#') &&
      !values.slackChannel.startsWith('@')
    ) {
      form.setError('slackChannel', { message: 'Slack channel must start with # or @' });
      return;
    }
    if (
      [AlertChannelType.Webhook, AlertChannelType.MsteamsWebhook].includes(values.type) &&
      !values.endpoint
    ) {
      form.setError('endpoint', { message: 'Endpoint is required' });
      return;
    }
    if (values.endpoint && !values.endpoint.startsWith('http')) {
      form.setError('endpoint', { message: 'Endpoint should be a valid URL' });
      return;
    }

    const { data, error } = await mutate({
      input: {
        name: values.channelName,
        type: values.type,
        organization: organizationId,
        project: projectId,
        webhook:
          form.getValues().type === AlertChannelType.Webhook ||
          form.getValues().type === AlertChannelType.MsteamsWebhook
            ? { endpoint: values.endpoint }
            : null,
        slack:
          form.getValues().type === AlertChannelType.Slack
            ? { channel: values.slackChannel }
            : null,
      },
    });
    // When Data is null, it means that the user has not integrated with Slack App
    if (!data) {
      toggleModalOpen();
      await toast({
        title: 'Please integrate with Slack App',
        description:
          'The channel has been created but you will not receive alerts until you integrate with Slack App',
        variant: 'destructive',
        duration: 10_000,
      });
    } else if (error || data?.addAlertChannel.error) {
      toast({
        title: 'Failed to create channel',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } else if (data?.addAlertChannel.ok) {
      toggleModalOpen();
      form.reset();
      toast({
        title: 'Channel created',
        description: 'You can now receive alerts on this channel',
        variant: 'default',
      });
    }
  }

  return (
    <CreateChannelModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      form={form}
      onSubmit={onSubmit}
      isWebhookLike={isWebhookLike}
    />
  );
};

export function CreateChannelModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  form: UseFormReturn<z.infer<typeof createChannelModalFormSchema>>;
  onSubmit: (values: CreateChannelModalFormValues) => void;
  isWebhookLike: boolean;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="channelName"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <DialogDescription className="mt-0 p-0">
                        This will be displayed on channels list, we recommend to make it
                        self-explanatory.
                      </DialogDescription>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Example: Slack #hives"
                          disabled={props.form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={props.form.control}
                name="type"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={async v => {
                            await field.onChange(v);
                          }}
                        >
                          <SelectTrigger>
                            {field.value === AlertChannelType.Slack
                              ? 'Slack'
                              : field.value === AlertChannelType.Webhook
                                ? 'Webhook'
                                : field.value === AlertChannelType.MsteamsWebhook
                                  ? 'MS Teams Webhook'
                                  : 'Select channel type'}
                          </SelectTrigger>
                          <SelectContent className="w-[--radix-select-trigger-width]">
                            <SelectItem value={AlertChannelType.Slack}>Slack</SelectItem>
                            <SelectItem value={AlertChannelType.Webhook}>Webhook</SelectItem>
                            <SelectItem value={AlertChannelType.MsteamsWebhook}>
                              MS Teams Webhook
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {props.isWebhookLike && (
                <FormField
                  control={props.form.control}
                  name="endpoint"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Endpoint</FormLabel>
                        <DialogDescription>
                          Hive will send alerts to your endpoint.
                        </DialogDescription>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Your endpoint"
                            disabled={props.form.formState.isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                        <DocsLink href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet">
                          Follow this guide to set up an incoming webhook connector in MS Teams
                        </DocsLink>
                      </FormItem>
                    );
                  }}
                />
              )}

              {props.form.getValues().type === AlertChannelType.Slack && (
                <FormField
                  control={props.form.control}
                  name="slackChannel"
                  rules={{
                    validate: value => {
                      if (!value.startsWith('#') && !value.startsWith('@')) {
                        return 'Slack channel must start with # or @';
                      }
                      return true;
                    },
                  }}
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Slack Channel</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Where should Hive post messages?"
                            disabled={props.form.formState.isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                        <DialogDescription>
                          Use <Tag>#channel</Tag> or <Tag>@username</Tag> form.
                          <DocsLink href="https://the-guild.dev/graphql/hive/docs/management/organizations#slack">
                            Please make sure to integrate with Slack App to start receiving alerts.
                          </DocsLink>
                        </DialogDescription>
                      </FormItem>
                    );
                  }}
                />
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                size="lg"
                className="w-full justify-center"
                onClick={ev => {
                  ev.preventDefault();
                  props.toggleModalOpen();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                variant="primary"
                disabled={props.form.formState.isSubmitting}
              >
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
