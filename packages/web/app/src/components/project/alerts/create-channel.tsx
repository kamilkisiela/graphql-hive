import { ReactElement, useEffect } from 'react';
import { Book, ExternalLinkIcon } from 'lucide-react';
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

export const createChannelSchema = z
  .object({
    channelName: z
      .string()
      .min(2, { message: 'Name must be at least 2 characters long' })
      .max(50, { message: 'Name must be at most 50 characters long' }),
    type: z.nativeEnum(AlertChannelType),
    slackChannel: z.string().optional(),
    endpoint: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === AlertChannelType.Slack && !data.slackChannel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slack channel is required',
        path: ['slackChannel'],
      });
    }
    if (
      (data.type === AlertChannelType.Webhook || data.type === AlertChannelType.MsteamsWebhook) &&
      !data.endpoint
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Endpoint is required',
        path: ['endpoint'],
      });
    }
    if (
      data.type === AlertChannelType.Slack &&
      !data.slackChannel?.startsWith('#') &&
      !data.slackChannel?.startsWith('@')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slack channel must start with # or @',
        path: ['slackChannel'],
      });
    }
    if (data.endpoint && !data.endpoint.startsWith('http')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Endpoint should be a valid URL',
        path: ['endpoint'],
      });
    }
  });

type CreateChannelFormValues = z.infer<typeof createChannelSchema>;

export const CreateChannelModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
  userHasSlackIntegration: boolean;
  hasAccessToSettingsIntegration: string[];
}): ReactElement => {
  const [, mutate] = useMutation(CreateChannel_AddAlertChannelMutation);
  const { toast } = useToast();

  const form = useForm<CreateChannelFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      channelName: '',
      type: AlertChannelType.Webhook,
      slackChannel: '',
      endpoint: '',
    },
  });

  const onSubmit = async (values: CreateChannelFormValues) => {
    const { data, error } = await mutate({
      input: {
        name: values.channelName,
        type: values.type,
        organization: props.organizationId,
        project: props.projectId,
        webhook: values.endpoint ? { endpoint: values.endpoint } : null,
        slack: values.slackChannel ? { channel: values.slackChannel } : null,
      },
    });

    if (error || data?.addAlertChannel.error) {
      toast({
        title: 'Failed to create channel',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } else {
      props.toggleModalOpen();
      form.reset();
      toast({
        title: 'Channel created',
        description: 'You can now receive alerts on this channel',
        variant: 'default',
      });
    }
  };

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type') {
        void form.trigger();
        if (value.type === AlertChannelType.Slack) {
          form.setValue('endpoint', '');
        } else {
          form.setValue('slackChannel', '');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const isWebhook = [AlertChannelType.Webhook, AlertChannelType.MsteamsWebhook].includes(
    form.watch('type'),
  );
  const hasIntegrationAccess = props.hasAccessToSettingsIntegration.includes('INTEGRATIONS');

  return (
    <CreateChannelModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      form={form}
      isWebhook={isWebhook}
      hasIntegrationAccess={hasIntegrationAccess}
      onSubmit={form.handleSubmit(onSubmit)}
      userHasSlackIntegration={props.userHasSlackIntegration}
      organizationId={props.organizationId}
    />
  );
};

export const CreateChannelModalContent = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  form: UseFormReturn<CreateChannelFormValues>;
  onSubmit: () => void;
  hasIntegrationAccess: boolean;
  isWebhook: boolean;
  userHasSlackIntegration: boolean;
  organizationId: string;
}): ReactElement => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.onSubmit}>
            <DialogHeader>
              <DialogTitle>Create a channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="channelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <DialogDescription>
                      This will be displayed on channels list, we recommend to make it
                      self-explanatory.
                    </DialogDescription>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Example: Slack #hives"
                        autoComplete="off"
                        disabled={props.form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={props.form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          {field.value === AlertChannelType.Slack
                            ? 'Slack'
                            : field.value === AlertChannelType.Webhook
                              ? 'Webhook'
                              : 'MS Teams Webhook'}
                        </SelectTrigger>
                        <SelectContent className="w-[--radix-select-trigger-width]">
                          {props.userHasSlackIntegration ? (
                            <SelectItem value={AlertChannelType.Slack}>Slack</SelectItem>
                          ) : (
                            <div className="flex w-full flex-row justify-stretch">
                              <SelectItem
                                value={AlertChannelType.Slack}
                                className="w-4/5"
                                disabled={!props.userHasSlackIntegration}
                              >
                                Slack - (Requires Integration)
                              </SelectItem>
                              {props.hasIntegrationAccess ? (
                                <Button
                                  asChild
                                  variant="link"
                                  className="mr-4 whitespace-pre-wrap p-0 text-orange-500"
                                >
                                  <a href={`/${props.organizationId}/view/settings`}>
                                    <Book className="mr-1 size-4" />
                                    Configure
                                    <ExternalLinkIcon className="inline size-4 pl-1" />
                                  </a>
                                </Button>
                              ) : (
                                <DocsLink
                                  className="w-2/5"
                                  href="https://the-guild.dev/graphql/hive/docs/management/organizations#slack"
                                >
                                  Instructions
                                </DocsLink>
                              )}
                            </div>
                          )}
                          <SelectItem value={AlertChannelType.Webhook}>Webhook</SelectItem>
                          <SelectItem value={AlertChannelType.MsteamsWebhook}>
                            MS Teams Webhook
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {props.isWebhook && (
                <FormField
                  control={props.form.control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://example.com/webhook"
                          autoComplete="off"
                          disabled={props.form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                      <DocsLink href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet">
                        Follow this guide to set up an incoming webhook connector in MS Teams
                      </DocsLink>
                    </FormItem>
                  )}
                />
              )}
              {props.form.watch('type') === AlertChannelType.Slack && (
                <FormField
                  control={props.form.control}
                  name="slackChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slack channel</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="#channel"
                          autoComplete="off"
                          disabled={props.form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                      <DialogDescription>
                        Use <Tag>#channel</Tag> or <Tag>@username</Tag> form.
                      </DialogDescription>
                    </FormItem>
                  )}
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
                size="lg"
                variant="primary"
                className="w-full justify-center"
                type="submit"
                disabled={props.form.formState.isSubmitting}
              >
                {props.form.formState.isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
