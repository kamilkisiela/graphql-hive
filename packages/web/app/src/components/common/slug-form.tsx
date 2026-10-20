import { type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/primitives/button/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { Input } from '@/components/ui/primitives/input/input';
import * as styles from './slug-form.css';

/** The slug rules shared by the organization, project and target settings pages. */
export function slugFormSchema(noun: 'Organization' | 'Project' | 'Target') {
  return z.object({
    slug: z
      .string({
        required_error: `${noun} slug is required`,
      })
      .min(1, `${noun} slug is required`)
      .max(50, 'Slug must be less than 50 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes'),
  });
}

export type SlugFormValues = z.infer<ReturnType<typeof slugFormSchema>>;

/**
 * The rename form on a settings page: the slug behind the URL it will live under, and Save. The
 * page owns the form state and the mutation.
 */
export function SlugForm(props: {
  form: UseFormReturn<SlugFormValues>;
  onSubmit: (values: SlugFormValues) => void | Promise<void>;
  /** The URL up to the slug, host included, ending in a slash. */
  prefixText: string;
}) {
  const { form } = props;
  return (
    <Form form={form} onSubmit={props.onSubmit}>
      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder="slug" prefixText={props.prefixText} width="md" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className={styles.slugFormDiv}>
        <Button disabled={form.formState.isSubmitting} type="submit">
          Save
        </Button>
      </div>
    </Form>
  );
}
