import { ReactElement } from 'react';
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
  const [_, mutate] = useMutation(CreateOrganizationMutation);
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { data, error } = await mutate({
      input: {
        name: values.name,
      },
    });

    if (data?.createOrganization.ok) {
      toast({
        title: 'Organization created',
        description: `You are now an admin of "${values.name}" organization.`,
      });
      void router.navigate({
        to: '/$organizationId',
        params: {
          organizationId:
            data.createOrganization.ok.createdOrganizationPayload.organization.cleanId,
        },
      });
    } else if (data?.createOrganization.error?.inputErrors?.name) {
      form.setError('name', {
        type: 'manual',
        message: data.createOrganization.error.inputErrors.name,
      });
    } else if (error) {
      toast({
        title: 'Failed to create organization',
        description: error.message,
      });
    }
  }

  return <CreateOrganizationFormContent form={form} onSubmit={() => onSubmit(form.getValues())} />;
};

export const CreateOrganizationFormContent = (props: {
  onSubmit: () => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
}): ReactElement => {
  return (
    <Form {...props.form}>
      <form className="bg-black" onSubmit={props.form.handleSubmit(props.onSubmit)}>
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
              control={props.form.control}
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
              disabled={
                props.form.formState.isSubmitting ||
                !props.form.formState.isValid ||
                props.form.formState.disabled
              }
            >
              {props.form.formState.isSubmitting ? (
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
