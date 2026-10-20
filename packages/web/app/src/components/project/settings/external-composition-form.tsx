import { type ReactNode } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/primitives/button/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { Input } from '@/components/ui/primitives/input/input';
import * as styles from './external-composition-form.css';

export const ExternalCompositionFormSchema = z.object({
  endpoint: z
    .string({
      required_error: 'Please provide an endpoint',
    })
    .url({
      message: 'Invalid URL',
    }),
  secret: z
    .string({
      required_error: 'Please provide a secret',
    })
    .min(2, 'Too short')
    .max(256, 'Max 256 characters long'),
});

export type ExternalCompositionFormValues = z.infer<typeof ExternalCompositionFormSchema>;

/** The endpoint and secret of the external composition section. The section owns the mutation. */
export function ExternalCompositionForm(props: {
  form: UseFormReturn<ExternalCompositionFormValues>;
  onSubmit: (values: ExternalCompositionFormValues) => void | Promise<void>;
  /** The reachability check beside the endpoint, shown until the fields are edited. */
  endpointStatus: ReactNode;
  /** The last save's failure, under the fields. */
  error?: string;
  submitLabel: string;
}) {
  const { form } = props;
  return (
    <Form form={form} onSubmit={props.onSubmit}>
      <div className={styles.externalCompositionFormDiv}>
        <FormField
          control={form.control}
          name="endpoint"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                label="HTTP Endpoint"
                tooltip="A POST request will be sent to that endpoint"
              />
              <div className={styles.externalCompositionFormDiv2}>
                <FormControl>
                  <Input
                    width="md"
                    placeholder="Endpoint"
                    type="text"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                {form.formState.isDirty ? null : props.endpointStatus}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="secret"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                label="Secret"
                tooltip="The secret is needed to sign and verify the request."
              />
              <FormControl>
                <Input
                  width="md"
                  placeholder="Secret"
                  type="password"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {props.error ? <div className={styles.externalCompositionFormDiv3}>{props.error}</div> : null}
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {props.submitLabel}
        </Button>
      </div>
    </Form>
  );
}
