import { ReactElement, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
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
import { graphql } from '@/gql';
import { zodResolver } from '@hookform/resolvers/zod';

const CollectionQuery = graphql(`
  query Collection($selector: TargetSelectorInput!, $id: ID!) {
    target(selector: $selector) {
      id
      documentCollection(id: $id) {
        id
        name
        description
      }
    }
  }
`);

const CreateCollectionMutation = graphql(`
  mutation CreateCollection(
    $selector: TargetSelectorInput!
    $input: CreateDocumentCollectionInput!
  ) {
    createDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        updatedTarget {
          id
          documentCollections {
            edges {
              cursor
              node {
                id
                name
              }
            }
          }
        }
        collection {
          id
          name
          description
          operations(first: 100) {
            edges {
              cursor
              node {
                id
                name
              }
              cursor
            }
          }
        }
      }
    }
  }
`);

const UpdateCollectionMutation = graphql(`
  mutation UpdateCollection(
    $selector: TargetSelectorInput!
    $input: UpdateDocumentCollectionInput!
  ) {
    updateDocumentCollection(selector: $selector, input: $input) {
      error {
        message
      }
      ok {
        updatedTarget {
          id
          documentCollections {
            edges {
              node {
                id
                name
              }
              cursor
            }
          }
        }
        collection {
          id
          name
          description
          operations(first: 100) {
            edges {
              cursor
              node {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`);

const createCollectionModalFormSchema = z.object({
  name: z
    .string({
      required_error: 'Collection name is required',
    })
    .min(2, {
      message: 'Collection name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Collection name must be at most 50 characters long',
    }),
  description: z.string().optional(),
});

export type CreateCollectionModalFormValues = z.infer<typeof createCollectionModalFormSchema>;

export function CreateCollectionModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  collectionId?: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const { isOpen, toggleModalOpen, collectionId } = props;
  const [mutationCreate, mutateCreate] = useMutation(CreateCollectionMutation);
  const [mutationUpdate, mutateUpdate] = useMutation(UpdateCollectionMutation);

  const [{ data, error: collectionError, fetching: loadingCollection }] = useQuery({
    query: CollectionQuery,
    variables: {
      id: collectionId!,
      selector: {
        targetSlug: props.targetSlug,
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
      },
    },
    pause: !collectionId,
  });

  const errorCombined = mutationCreate.error || collectionError || mutationUpdate.error;
  const fetching = loadingCollection;

  const form = useForm<CreateCollectionModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createCollectionModalFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!collectionId) {
      form.reset();
    } else if (data) {
      const { documentCollection } = data.target!;
      if (documentCollection) {
        void form.setValue('name', documentCollection.name);
        void form.setValue('description', documentCollection.description || '');
      }
    }
  }, [data, collectionId]);

  async function onSubmit(values: CreateCollectionModalFormValues) {
    const { error } = collectionId
      ? await mutateUpdate({
          selector: {
            targetSlug: props.targetSlug,
            organizationSlug: props.organizationSlug,
            projectSlug: props.projectSlug,
          },
          input: {
            collectionId,
            name: values.name,
            description: values.description,
          },
        })
      : await mutateCreate({
          selector: {
            targetSlug: props.targetSlug,
            organizationSlug: props.organizationSlug,
            projectSlug: props.projectSlug,
          },
          input: values,
        });
    if (!error || errorCombined) {
      form.reset();
      toggleModalOpen();
    }
  }

  return (
    <CreateCollectionModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      onSubmit={onSubmit}
      form={form}
      collectionId={collectionId}
      fetching={fetching}
    />
  );
}

export function CreateCollectionModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  onSubmit: (values: CreateCollectionModalFormValues) => void;
  form: UseFormReturn<CreateCollectionModalFormValues>;
  collectionId?: string;
  fetching: boolean;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        {!props.fetching && (
          <Form {...props.form}>
            <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
              <DialogHeader>
                <DialogTitle>
                  {props.collectionId ? 'Update' : 'Create'} Shared Collection
                </DialogTitle>
                <DialogDescription>
                  {props.collectionId
                    ? 'Update the shared collection name and description'
                    : 'Create a shared collection that everyone in the organization can access'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-8">
                <FormField
                  control={props.form.control}
                  name="name"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Collection Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="My Collection" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={props.form.control}
                  name="description"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Collection Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="My Collection" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <Callout type="info" className="mt-0">
                This collection will be available to everyone in the organization
              </Callout>
              <DialogFooter>
                <Button
                  type="button"
                  size="lg"
                  className="w-full justify-center"
                  onClick={ev => {
                    ev.preventDefault();
                    props.toggleModalOpen();
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
                  {props.collectionId ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
