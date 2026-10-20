import { useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Select } from '@/components/ui/primitives/floating/select/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { Input } from '@/components/ui/primitives/input/input';
import { AlertChannelType } from '@/gql/graphql';
import * as styles from './channel-form.css';

/** The dialog footer's submit button lives outside the form and targets it by this id. */
export const CHANNEL_FORM_ID = 'create-channel-form';

export function isWebhookLike(type: AlertChannelType | '') {
  return (
    type === AlertChannelType.Webhook ||
    type === AlertChannelType.MsteamsWebhook ||
    type === AlertChannelType.Discord
  );
}

/** Channel types whose endpoint has to be created in a third-party UI first. */
const WEBHOOK_SETUP_GUIDES: Partial<Record<AlertChannelType, { href: string; label: string }>> = {
  [AlertChannelType.MsteamsWebhook]: {
    href: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet',
    label: 'Follow this guide to set up an incoming webhook connector in MS Teams',
  },
  [AlertChannelType.Discord]: {
    href: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
    label: 'Follow this guide to set up a Discord webhook',
  },
};

export const ChannelFormSchema = z
  .object({
    name: z.string().min(1, 'Must enter name'),
    type: z.nativeEnum(AlertChannelType, { errorMap: () => ({ message: 'Must select type' }) }),
    slackChannel: z.string(),
    endpoint: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.type === AlertChannelType.Slack) {
      if (!values.slackChannel) {
        ctx.addIssue({
          code: 'custom',
          path: ['slackChannel'],
          message: 'Must enter slack channel',
        });
      } else if (!/^[@#]/.test(values.slackChannel)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slackChannel'],
          message: 'Must start with a @ or # character',
        });
      }
    }
    if (isWebhookLike(values.type)) {
      if (!values.endpoint) {
        ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'Must enter endpoint' });
      } else if (!z.string().url().safeParse(values.endpoint).success) {
        ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'Must be a valid URL' });
      }
    }
  });

export type ChannelFormValues = z.infer<typeof ChannelFormSchema>;

/**
 * The body of the create channel dialog: name and type, then the field the type calls for. The
 * dialog owns the form state and the mutation.
 */
export function ChannelForm(props: {
  form: UseFormReturn<ChannelFormValues>;
  onSubmit: (values: ChannelFormValues) => void | Promise<void>;
}) {
  const { form } = props;
  const type = useWatch({ control: form.control, name: 'type' });
  const endpoint = useWatch({ control: form.control, name: 'endpoint' });
  // Once an endpoint has been pasted in, the setup guide has served its purpose.
  const setupGuide = endpoint ? undefined : WEBHOOK_SETUP_GUIDES[type];

  return (
    <Form form={form} onSubmit={props.onSubmit} attrs={{ id: CHANNEL_FORM_ID }}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel
              label="Name"
              tooltip="This will be displayed on channels list, we recommend to make it self-explanatory."
            />
            <FormControl>
              <Input placeholder="Example: Slack #hives" onSurface="raised" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Type" />
            <FormControl>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Select channel type"
                options={[
                  { value: AlertChannelType.Slack, label: 'Slack' },
                  { value: AlertChannelType.Webhook, label: 'Webhook' },
                  { value: AlertChannelType.MsteamsWebhook, label: 'MS Teams Webhook' },
                  { value: AlertChannelType.Discord, label: 'Discord Webhook' },
                ]}
                width="full"
                onSurface="raised"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {isWebhookLike(type) ? (
        <FormField
          control={form.control}
          name="endpoint"
          render={({ field }) => (
            <FormItem>
              <FormLabel label="Endpoint" tooltip="Hive will send alerts to your endpoint." />
              <FormControl>
                <Input placeholder="Your endpoint" onSurface="raised" {...field} />
              </FormControl>
              <FormMessage />
              {setupGuide ? (
                <a
                  href={setupGuide.href}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.channelFormA}
                >
                  {setupGuide.label}
                </a>
              ) : null}
            </FormItem>
          )}
        />
      ) : null}
      {type === AlertChannelType.Slack ? (
        <FormField
          control={form.control}
          name="slackChannel"
          render={({ field }) => (
            <FormItem>
              <FormLabel label="Slack Channel" tooltip="Use the #channel or @username form." />
              <FormControl>
                <Input
                  placeholder="Where should Hive post messages?"
                  onSurface="raised"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </Form>
  );
}
