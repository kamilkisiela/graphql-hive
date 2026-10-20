import { BlocksIcon, BoxIcon, FoldVerticalIcon } from 'lucide-react';
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
import { RadioGroup } from '@/components/ui/primitives/radio-group/radio-group';
import { ProjectType } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import * as styles from './create-project-form.css';

export const CreateProjectFormSchema = z.object({
  projectSlug: z
    .string({
      required_error: 'Project slug is required',
    })
    .min(2, {
      message: 'Project slug must be at least 2 characters long',
    })
    .max(50, {
      message: 'Project slug must be at most 50 characters long',
    }),
  projectType: z.nativeEnum(ProjectType, {
    required_error: 'Project type is required',
  }),
});

export type CreateProjectFormValues = z.infer<typeof CreateProjectFormSchema>;

const PROJECT_TYPES = [
  {
    type: ProjectType.Single,
    title: 'Monolith',
    description: 'Single GraphQL schema developed as a monolith',
    Icon: BoxIcon,
  },
  {
    type: ProjectType.Federation,
    title: 'Federation',
    description: 'Project developed according to Apollo Federation specification',
    Icon: BlocksIcon,
  },
  {
    type: ProjectType.Stitching,
    title: 'Stitching',
    description: 'Project that stitches together multiple GraphQL APIs',
    Icon: FoldVerticalIcon,
  },
];

/**
 * The body of the create-project dialog. The layout owns the dialog, the form state and the
 * mutation, so this can be exercised on its own.
 */
export function CreateProjectForm(props: {
  form: UseFormReturn<CreateProjectFormValues>;
  onSubmit: (values: CreateProjectFormValues) => void | Promise<void>;
}) {
  const { form } = props;
  return (
    // The submit stays inside the form: the e2e helper selects it through the form.
    <Form form={form} onSubmit={props.onSubmit} attrs={{ 'data-cy': 'create-project-form' }}>
      <FormField
        control={form.control}
        name="projectSlug"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Slug of your project" />
            <FormControl>
              <Input
                placeholder="my-project"
                data-cy="slug"
                autoComplete="off"
                onSurface="raised"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="projectType"
        render={({ field }) => (
          <FormItem group>
            <FormLabel label="Project Type" />
            <RadioGroup
              variant="as-card"
              onSurface="raised"
              orientation="vertical"
              value={field.value}
              onValueChange={field.onChange}
              items={PROJECT_TYPES.map(({ type, title, description, Icon }) => ({
                value: type,
                ariaLabel: title,
                content: (
                  <>
                    <Icon
                      className={cn(
                        styles.createProjectFormIcon,
                        field.value === type
                          ? styles.createProjectFormIcon2
                          : styles.createProjectFormIcon3,
                      )}
                    />
                    <div>
                      <span className={styles.createProjectFormSpan}>{title}</span>
                      <p className={styles.createProjectFormP}>{description}</p>
                    </div>
                  </>
                ),
              }))}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <div className={styles.createProjectFormDiv}>
        <Button
          width="full"
          onSurface="raised"
          type="submit"
          data-cy="submit"
          disabled={form.formState.isSubmitting || !form.formState.isValid}
        >
          {form.formState.isSubmitting ? 'Submitting...' : 'Create Project'}
        </Button>
      </div>
    </Form>
  );
}
