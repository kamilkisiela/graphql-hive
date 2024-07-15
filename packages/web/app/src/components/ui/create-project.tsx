import { FunctionComponentElement, ReactElement } from 'react';
import { BlocksIcon, BoxIcon, FoldVerticalIcon } from 'lucide-react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Slot } from '@radix-ui/react-slot';
import { useRouter } from '@tanstack/react-router';

export const CreateProjectMutation = graphql(`
  mutation CreateProject_CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ok {
        createdProject {
          id
          name
          cleanId
        }
        createdTargets {
          id
          name
          cleanId
        }
        updatedOrganization {
          id
        }
      }
      error {
        message
        inputErrors {
          name
          buildUrl
          validationUrl
        }
      }
    }
  }
`);

const formSchema = z.object({
  projectName: z
    .string({
      required_error: 'Project name is required',
    })
    .min(2, {
      message: 'Project name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Project name must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Project name restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
  projectType: z.nativeEnum(ProjectType, {
    required_error: 'Project type is required',
  }),
});

type ProjectTypeCardProps = {
  title: string;
  description: string;
  type: ProjectType;
  icon: FunctionComponentElement<{ className: string }>;
};

export function ProjectTypeCard({ ...props }: ProjectTypeCardProps): ReactElement {
  return (
    <FormItem>
      <FormLabel className="[&:has([data-state=checked])>div]:border-primary cursor-pointer">
        <FormControl>
          <RadioGroupItem value={props.type} className="sr-only" />
        </FormControl>
        <div className="border-muted hover:border-accent hover:bg-accent flex items-center gap-4 rounded-md border-2 p-4">
          <Slot className="size-8 text-gray-400">{props.icon}</Slot>
          <div>
            <span className="text-sm font-medium">{props.title}</span>
            <p className="text-sm text-gray-400">{props.description}</p>
          </div>
        </div>
      </FormLabel>
    </FormItem>
  );
}

type CreateProjectModalProps = {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
};

export const CreateProjectModal = ({ ...props }: CreateProjectModalProps): ReactElement => {
  const { organizationId } = props;
  const [_, mutate] = useMutation(CreateProjectMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: '',
      projectType: ProjectType.Single,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { data, error } = await mutate({
      input: {
        organization: props.organizationId,
        name: values.projectName,
        type: values.projectType,
      },
    });
    if (data?.createProject.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationId/$projectId',
        params: {
          organizationId,
          projectId: data.createProject.ok.createdProject.cleanId,
        },
      });
    } else if (data?.createProject.error?.inputErrors.name) {
      form.setError('projectName', {
        message: data?.createProject.error?.inputErrors.name,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create project',
        description: error?.message || data?.createProject.error?.message,
      });
    }
  }

  return (
    <CreateProjectModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      form={form}
      onSubmit={onSubmit}
    />
  );
};

type CreateProjectModalContentProps = {
  isOpen: boolean;
  toggleModalOpen: () => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  onSubmit: (values: z.infer<typeof formSchema>) => void | Promise<void>;
};

export const CreateProjectModalContent = ({
  ...props
}: CreateProjectModalContentProps): ReactElement => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>
                A Hive <b>project</b> represents a <b>GraphQL API</b> running a GraphQL schema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="projectName"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Name of your project</FormLabel>
                      <FormControl>
                        <Input placeholder="My GraphQL API" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={props.form.control}
                name="projectType"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="pt-2"
                      >
                        <ProjectTypeCard
                          type={ProjectType.Single}
                          title="Single"
                          description="Monolithic GraphQL schema developed as a standalone"
                          icon={<BoxIcon />}
                        />
                        <ProjectTypeCard
                          type={ProjectType.Federation}
                          title="Federation"
                          description="Project developed according to Apollo Federation specification"
                          icon={<BlocksIcon />}
                        />
                        <ProjectTypeCard
                          type={ProjectType.Stitching}
                          title="Stitching"
                          description="Project that stitches together multiple GraphQL APIs"
                          icon={<FoldVerticalIcon />}
                        />
                      </RadioGroup>
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
                {props.form.formState.isSubmitting ? 'Submitting...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
