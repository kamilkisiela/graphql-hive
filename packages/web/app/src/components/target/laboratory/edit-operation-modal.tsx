import { ReactElement, useMemo } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { useCollections } from '@/lib/hooks/laboratory/use-collections';
import { useEditorContext } from '@graphiql/react';
import { zodResolver } from '@hookform/resolvers/zod';

const UpdateOperationNameMutation = graphql(`
  mutation UpdateOperation(
    $selector: TargetSelectorInput!
    $input: UpdateDocumentCollectionOperationInput!
  ) {
    updateOperationInDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        operation {
          id
          name
          query
          variables
          headers
        }
      }
    }
  }
`);

const editOperationModalFormSchema = z.object({
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

export type EditOperationModalFormValues = z.infer<typeof editOperationModalFormSchema>;

export const EditOperationModal = (props: {
  operationId: string;
  close: () => void;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement => {
  const { toast } = useToast();
  const [updateOperationNameState, mutate] = useMutation(UpdateOperationNameMutation);
  const { collections } = useCollections({
    organizationSlug: props.organizationSlug,
    projectSlug: props.projectSlug,
    targetSlug: props.targetSlug,
  });
  const { setTabState } = useEditorContext({ nonNull: true });

  const [collection, operation] = useMemo(() => {
    for (const collection of collections) {
      for (const operation of collection.operations.edges) {
        if (operation.node.id === props.operationId) {
          return [collection, operation.node] as const;
        }
      }
    }
    return [null, null] as const;
  }, [collections]);

  const form = useForm<EditOperationModalFormValues>({
    mode: 'all',
    resolver: zodResolver(editOperationModalFormSchema),
    defaultValues: {
      name: operation?.name || '',
      collectionId: collection?.id || '',
    },
  });

  async function onSubmit(values: EditOperationModalFormValues) {
    const response = await mutate({
      selector: {
        targetSlug: props.targetSlug,
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
      },
      input: {
        collectionId: values.collectionId,
        operationId: props.operationId,
        name: values.name,
      },
    });
    const error = response.error || response.data?.updateOperationInDocumentCollection?.error;

    if (!error) {
      // Update tab title
      setTabState(state => ({
        ...state,
        tabs: state.tabs.map(tab =>
          tab.id === props.operationId ? { ...tab, title: values.name } : tab,
        ),
      }));
      props.close();
      toast({
        title: 'Operation Updated',
        description: 'Operation has been updated successfully',
        variant: 'default',
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <EditOperationModalContent
      fetching={updateOperationNameState.fetching}
      close={props.close}
      isOpen
      form={form}
      onSubmit={onSubmit}
    />
  );
};

export const EditOperationModalContent = (props: {
  fetching: boolean;
  isOpen: boolean;
  close: () => void;
  form: UseFormReturn<EditOperationModalFormValues>;
  onSubmit: (values: EditOperationModalFormValues) => void;
  opreationId?: string;
}): ReactElement => {
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={() => {
        props.close();
        props.form.reset();
      }}
    >
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        {!props.fetching && (
          <Form {...props.form}>
            <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
              <DialogHeader>
                <DialogTitle>Edit Operation</DialogTitle>
                <DialogDescription>Update the operation name</DialogDescription>
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
                          <Input autoComplete="off" {...field} placeholder="Your Operation Name" />
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
                  disabled={
                    props.form.formState.isSubmitting ||
                    !props.form.formState.isValid ||
                    !props.form.formState.isDirty
                  }
                  data-cy="confirm"
                >
                  Update Operation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
