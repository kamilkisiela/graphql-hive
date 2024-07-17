import { ReactElement } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
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
  targetName: z
    .string({
      required_error: 'Target name is required',
    })
    .min(2, {
      message: 'Target name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Target name must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Target name restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
});

type CreateTargetModalProps = {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
};

export const CreateTargetModal = ({ ...props }: CreateTargetModalProps): ReactElement => {
  const { organizationId, projectId } = props;
  const [_, mutate] = useMutation(CreateTarget_CreateTargetMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetName: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { data, error } = await mutate({
      input: {
        project: props.projectId,
        organization: props.organizationId,
        name: values.targetName,
      },
    });

    if (data?.createTarget.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationId/$projectId/$targetId',
        params: {
          organizationId,
          projectId,
          targetId: data.createTarget.ok.createdTarget.cleanId,
        },
      });
      toast({
        variant: 'default',
        title: 'Target created',
        description: `Your target "${data.createTarget.ok.createdTarget.name}" has been created`,
      });
    } else if (data?.createTarget.error?.inputErrors.name) {
      form.setError('targetName', {
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
    <CreateTargetModalContent
      form={form}
      isOpen={props.isOpen}
      onSubmit={onSubmit}
      toggleModalOpen={props.toggleModalOpen}
    />
  );
};

type CreateTargetModalContentProps = {
  isOpen: boolean;
  toggleModalOpen: () => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void | Promise<void>;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export const CreateTargetModalContent = ({
  ...props
}: CreateTargetModalContentProps): ReactElement => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[520px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a new target</DialogTitle>
              <DialogDescription>
                A project is built on top of <b>Targets</b>, which are just your environments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="targetName"
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
                disabled={props.form.formState.isSubmitting || !props.form.formState.isValid}
              >
                {props.form.formState.isSubmitting ? 'Submitting...' : 'Create Target'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
