import { useForm } from 'react-hook-form';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';

export const CreateTarget_CreateTargetMutation = graphql(`
  mutation CreateTarget_CreateTarget($input: CreateTargetInput!) {
    createTarget(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        createdTarget {
          id
          cleanId
          name
        }
      }
      error {
        message
        inputErrors {
          name
        }
      }
    }
  }
`);

const formSchema = z.object({
  name: z.string().min(1, {
    message: 'Target name is required',
  }),
});

export const CreateTargetModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
}) => {
  const { isOpen, toggleModalOpen } = props;
  const [_, mutate] = useMutation(CreateTarget_CreateTargetMutation);
  const router = useRouter();
  const { toast } = useToast();

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
        project: props.projectId,
        organization: props.organizationId,
        name: values.name,
      },
    });

    if (data?.createTarget.ok) {
      toggleModalOpen();
      void router.navigate({
        to: '/$organizationId/$projectId/$targetId',
        params: {
          organizationId: props.organizationId,
          projectId: props.projectId,
          targetId: data.createTarget.ok.createdTarget.cleanId,
        },
      });
      toast({
        variant: 'default',
        title: 'Target created',
        description: `Your target "${data.createTarget.ok.createdTarget.name}" has been created`,
      });
    } else if (data?.createTarget.error?.inputErrors.name) {
      form.setError('name', {
        message: data?.createTarget.error?.inputErrors.name,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create target',
        description: error?.message || data?.createTarget.error?.message,
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="absolute w-[600px] max-w-none">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <DialogHeader>
              <DialogTitle>Create a new target</DialogTitle>
              <DialogDescription>
                A project is built on top of <b>Targets</b>, which are just your environments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Target name" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                type="submit"
                disabled={form.formState.isSubmitting || !form.formState.isValid}
              >
                {form.formState.isSubmitting ? 'Submitting...' : 'Create Target'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
