import { type UseFormReturn } from 'react-hook-form';
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
import { AlertType } from '@/gql/graphql';
import * as styles from './alert-form.css';

/** The dialog footer's submit button lives outside the form and targets it by this id. */
export const ALERT_FORM_ID = 'create-alert-form';

/** The channel and target have to be ones the project offers, so the schema is built from them. */
export function alertFormSchema(options: { channelIds: string[]; targetSlugs: string[] }) {
  return z.object({
    type: z.literal(AlertType.SchemaChangeNotifications, {
      errorMap: () => ({ message: 'Must select type' }),
    }),
    channel: z.string().refine(value => options.channelIds.includes(value), 'Must select channel'),
    target: z.string().refine(value => options.targetSlugs.includes(value), 'Must select target'),
  });
}

export type AlertFormValues = z.infer<ReturnType<typeof alertFormSchema>>;

/** The body of the create alert dialog. The dialog owns the form state and the mutation. */
export function AlertForm(props: {
  form: UseFormReturn<AlertFormValues>;
  onSubmit: (values: AlertFormValues) => void | Promise<void>;
  channels: readonly { id: string; name: string }[];
  targets: readonly { slug: string }[];
  /** The last request's failure, under the fields. */
  error?: string;
}) {
  const { form } = props;
  return (
    <Form form={form} onSubmit={props.onSubmit} attrs={{ id: ALERT_FORM_ID }}>
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Type" />
            <FormControl>
              <Select
                name={field.name}
                placeholder="Select alert type"
                options={[
                  {
                    value: AlertType.SchemaChangeNotifications,
                    label: 'Schema Change Notifications',
                  },
                ]}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                width="full"
                onSurface="raised"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="channel"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Channel" />
            <FormControl>
              <Select
                name={field.name}
                placeholder="Select channel"
                options={props.channels.map(channel => ({
                  value: channel.id,
                  label: channel.name,
                }))}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                width="full"
                onSurface="raised"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="target"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Target" />
            <FormControl>
              <Select
                name={field.name}
                placeholder="Select target"
                options={props.targets.map(target => ({
                  value: target.slug,
                  label: target.slug,
                }))}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                width="full"
                onSurface="raised"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {props.error ? <div className={styles.alertFormDiv}>{props.error}</div> : null}
    </Form>
  );
}
