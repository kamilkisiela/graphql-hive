import { ReactElement, useEffect } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { TargetDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

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
            nodes {
              id
              name
            }
          }
        }
        collection {
          id
          name
          operations(first: 100) {
            nodes {
              id
              name
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
            nodes {
              id
              name
            }
          }
        }
        collection {
          id
          name
          operations(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`);

export function CreateCollectionModal({
  isOpen,
  toggleModalOpen,
  collectionId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  collectionId?: string;
}): ReactElement {
  const router = useRouteSelector();
  const [mutationCreate, mutateCreate] = useMutation(CreateCollectionMutation);
  const [mutationUpdate, mutateUpdate] = useMutation(UpdateCollectionMutation);

  const [result] = useQuery({
    query: TargetDocument,
    variables: {
      targetId: router.targetId,
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
  });

  const [{ data, error: collectionError, fetching: loadingCollection }] = useQuery({
    query: CollectionQuery,
    variables: {
      id: collectionId!,
      selector: {
        target: router.targetId,
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    pause: !collectionId,
  });

  const error = mutationCreate.error || result.error || collectionError || mutationUpdate.error;
  const fetching = loadingCollection || result.fetching;

  useEffect(() => {
    if (!collectionId) {
      resetForm();
    } else if (data) {
      const { documentCollection } = data.target!;
      void setValues({
        name: documentCollection.name,
        description: documentCollection.description || '',
      });
    }
  }, [data, collectionId]);

  const {
    handleSubmit,
    values,
    handleChange,
    errors,
    touched,
    isSubmitting,
    setValues,
    resetForm,
  } = useFormik({
    initialValues: {
      name: '',
      description: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().required(),
      description: Yup.string(),
    }),
    async onSubmit(values) {
      const { error } = collectionId
        ? await mutateUpdate({
            selector: {
              target: router.targetId,
              organization: router.organizationId,
              project: router.projectId,
            },
            input: {
              collectionId,

              name: values.name,
              description: values.description,
            },
          })
        : await mutateCreate({
            selector: {
              target: router.targetId,
              organization: router.organizationId,
              project: router.projectId,
            },
            input: values,
          });
      if (!error) {
        resetForm();
        toggleModalOpen();
      }
    },
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      {!fetching && (
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          <Heading className="text-center">
            {collectionId ? 'Update' : 'Create'} Shared Collection
          </Heading>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="name">
              Collection Name
            </label>
            <Input
              data-cy="input.name"
              name="name"
              placeholder="My Collection"
              value={values.name}
              onChange={handleChange}
              isInvalid={!!(touched.name && errors.name)}
            />
            {touched.name && errors.name && (
              <div className="text-sm text-red-500">{errors.name}</div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="description">
              Collection Description
            </label>

            <Input
              data-cy="input.description"
              name="description"
              value={values.description}
              onChange={handleChange}
              isInvalid={!!(touched.description && errors.description)}
            />
            {touched.description && errors.description && (
              <div className="text-sm text-red-500">{errors.description}</div>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error.message}</div>}

          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={toggleModalOpen}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              disabled={isSubmitting}
              data-cy="confirm"
            >
              {collectionId ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
