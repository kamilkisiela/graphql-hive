import { ReactElement } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { DocumentCollection } from '@/gql/graphql';
import { useCollections } from '@/lib/hooks/laboratory/use-collections';
import { useEditorContext } from '@graphiql/react';
import { zodResolver } from '@hookform/resolvers/zod';

const CreateOperationMutation = graphql(`
  mutation CreateOperation(
    $selector: TargetSelectorInput!
    $input: CreateDocumentCollectionOperationInput!
  ) {
    createOperationInDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        operation {
          id
          name
        }
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
                operations {
                  edges {
                    node {
                      id
                    }
                    cursor
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

export type CreateOperationMutationType = typeof CreateOperationMutation;

const createOperationModalFormSchema = z.object({
  name: z
    .string({
      required_error: 'Operation name is required',
    })
    .min(3, {
      message: 'Operation name must be at least 3 characters long',
    })
    .max(50, {
      message: 'Operation name must be less than 50 characters long',
    }),
  collectionId: z.string({
    required_error: 'Collection is required',
  }),
});

export type CreateOperationModalFormValues = z.infer<typeof createOperationModalFormSchema>;

export function CreateOperationModal(props: {
  isOpen: boolean;
  close: () => void;
  onSaveSuccess: (args: { id: string; name: string }) => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const { toast } = useToast();
  const { isOpen, close, onSaveSuccess } = props;
  const [mutationCreate, mutateCreate] = useMutation(CreateOperationMutation);

  const { collections, fetching } = useCollections({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const { queryEditor, variableEditor, headerEditor } = useEditorContext({
    nonNull: true,
  });

  const form = useForm<CreateOperationModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createOperationModalFormSchema),
    defaultValues: {
      name: '',
      collectionId: '',
    },
  });

  async function onSubmit(values: CreateOperationModalFormValues) {
    if (mutationCreate.error) {
      form.setError('name', {
        message: mutationCreate.error.message,
      });
    }
    const response = await mutateCreate({
      selector: {
        target: props.targetId,
        organization: props.organizationId,
        project: props.projectId,
      },
      input: {
        name: values.name,
        collectionId: values.collectionId,
        query: queryEditor?.getValue() ?? '',
        variables: variableEditor?.getValue(),
        headers: headerEditor?.getValue(),
      },
    });
    const result = response.data;
    const error = response.error || response.data?.createOperationInDocumentCollection.error;

    if (!error) {
      const operation = result?.createOperationInDocumentCollection.ok?.operation;
      if (operation) {
        onSaveSuccess({ id: operation.id, name: operation.name });
      }
      form.reset();
      close();
    } else {
      toast({
        title: 'Could not create operation',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <CreateOperationModalContent
      close={close}
      onSubmit={onSubmit}
      isOpen={isOpen}
      organizationId={props.organizationId}
      projectId={props.projectId}
      targetId={props.targetId}
      fetching={fetching}
      form={form}
      collections={collections}
    />
  );
}

type DocumentCollectionWithOutOperations = Omit<
  DocumentCollection,
  'createdBy' | 'createdAt' | 'updatedAt' | 'operations' | 'pageInfo'
>;

export function CreateOperationModalContent(props: {
  isOpen: boolean;
  close: () => void;
  onSubmit: (values: CreateOperationModalFormValues) => void;
  organizationId: string;
  projectId: string;
  form: UseFormReturn<CreateOperationModalFormValues>;
  targetId: string;
  fetching: boolean;
  collections: DocumentCollectionWithOutOperations[];
}): ReactElement {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        {!props.fetching && (
          <Form {...props.form}>
            <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
              <DialogHeader>
                <DialogTitle>Create Operation</DialogTitle>
              </DialogHeader>
              <div className="space-y-8">
                <FormField
                  control={props.form.control}
                  name="name"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Operation Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your Operation Name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={props.form.control}
                  name="collectionId"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Collection Description</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={async v => {
                              await field.onChange(v);
                            }}
                          >
                            <SelectTrigger>
                              {props.collections.find(c => c.id === field.value)?.name ??
                                'Select a Collection'}
                            </SelectTrigger>
                            <SelectContent className="w-[--radix-select-trigger-width]">
                              {props.collections.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                  <div className="mt-1 line-clamp-1 text-xs opacity-50">
                                    {c.description}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="lg"
                  className="w-full justify-center"
                  onClick={ev => {
                    ev.preventDefault();
                    props.close();
                    props.form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full justify-center"
                  variant="primary"
                  disabled={props.form.formState.isSubmitting || !props.form.formState.isValid}
                  data-cy="confirm"
                >
                  Add Operation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
