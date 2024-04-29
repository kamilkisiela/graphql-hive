import { useForm } from 'react-hook-form';
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/v2';
import { graphql } from '@/gql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';

export const CreateOrganizationMutation = graphql(`
  mutation CreateOrganizationMutation($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      ok {
        createdOrganizationPayload {
          selector {
            organization
          }
          organization {
            cleanId
            id
            cleanId
          }
        }
      }
      error {
        inputErrors {
          name
        }
      }
    }
  }
`);

const formSchema = z.object({
  name: z
    .string({
      required_error: 'Organization name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Name restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
});

export const CreateOrganizationForm = () => {
  const [mutation, mutate] = useMutation(CreateOrganizationMutation);
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
    disabled: mutation.fetching,
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const mutation = await mutate({
      input: {
        name: values.name,
      },
    });

    if (mutation.data?.createOrganization.ok) {
      toast({
        title: 'Organization created',
        description: `You are now an admin of "${values.name}" organization.`,
      });
      void router.navigate({
        to: '/$organizationId',
        params: {
          organizationId:
            mutation.data.createOrganization.ok.createdOrganizationPayload.organization.cleanId,
        },
      });
    } else if (mutation.data?.createOrganization.error?.inputErrors?.name) {
      form.setError('name', {
        type: 'manual',
        message: mutation.data.createOrganization.error.inputErrors.name,
      });
    } else if (mutation.error) {
      toast({
        title: 'Failed to create organization',
        description: mutation.error.message,
      });
    }
  }

  return (
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Organization name" {...field} />
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
              disabled={form.formState.disabled}
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
  );
};
