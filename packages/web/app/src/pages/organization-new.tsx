import { ReactElement } from 'react';
import { LogOutIcon } from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DottedBackground } from '@/components/ui/dotted-background';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { HiveLogo } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/meta';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from '@tanstack/react-router';

export function NewOrgPage(): ReactElement {
  const router = useRouter();
  return (
    <>
      <Meta title="Create Organization" />
      <DottedBackground className="min-h-[100vh]">
        <div className="flex h-full grow items-center">
          <Button
            variant="outline"
            onClick={() =>
              void router.navigate({
                to: '/logout',
              })
            }
            className="absolute right-6 top-6"
          >
            <LogOutIcon className="mr-2 size-4" /> Sign out
          </Button>
          <Link to="/" className="absolute left-6 top-6">
            <HiveLogo className="size-10" />
          </Link>
          <CreateOrganizationForm />
        </div>
      </DottedBackground>
    </>
  );
}

export const CreateOrganizationMutation = graphql(`
  mutation CreateOrganizationMutation($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      ok {
        createdOrganizationPayload {
          selector {
            organizationSlug
          }
          organization {
            id
            slug
          }
        }
      }
      error {
        message
        inputErrors {
          slug
        }
      }
    }
  }
`);

const formSchema = z.object({
  slug: z
    .string({
      required_error: 'Organization slug is required',
    })
    .min(1, 'Organization slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes'),
});

export const CreateOrganizationForm = (): JSX.Element => {
  const [mutation, mutate] = useMutation(CreateOrganizationMutation);
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: '',
    },
    disabled: mutation.fetching,
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const mutation = await mutate({
      input: {
        slug: values.slug,
      },
    });

    const errorMessage =
      mutation.data?.createOrganization.error?.inputErrors?.slug ||
      mutation.data?.createOrganization.error?.message;

    if (mutation.data?.createOrganization.ok) {
      toast({
        title: 'Organization created',
        description: `You are now an admin of "${values.slug}" organization.`,
      });
      void router.navigate({
        to: '/$organizationSlug',
        params: {
          organizationSlug:
            mutation.data.createOrganization.ok.createdOrganizationPayload.organization.slug,
        },
      });
    } else if (errorMessage) {
      form.setError('slug', {
        type: 'manual',
        message: errorMessage,
      });
    } else if (mutation.error) {
      toast({
        title: 'Failed to create organization',
        description: mutation.error.message,
      });
    }
  }
  return <CreateOrganizationFormContent form={form} onSubmit={onSubmit} />;
};

type CreateOrganizationFormContentProps = {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  onSubmit: (values: z.infer<typeof formSchema>) => void | Promise<void>;
};

export const CreateOrganizationFormContent = ({
  form,
  onSubmit,
}: CreateOrganizationFormContentProps): JSX.Element => {
  return (
    <div className="container w-4/5 max-w-[520px] md:w-3/5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-black">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Create an organization</CardTitle>
              <CardDescription>
                An organization is built on top of <b>Projects</b>. You will become an <b>admin</b>{' '}
                and don't worry, you can add members later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="my-organization" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                variant="default"
                disabled={!form.formState.isValid}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Spinner className="size-6 text-black" />
                    <span className="ml-4">Creating...</span>
                  </>
                ) : (
                  'Create Organization'
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
};
