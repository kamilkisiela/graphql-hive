import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal, Select } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useCollections } from '@/lib/hooks/use-collections';
import { useEditorContext } from '@graphiql/react';

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
        collection {
          id
          operations {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`);

export function CreateOperationModal({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement {
  const router = useRouteSelector();
  const [mutationCreate, mutateCreate] = useMutation(CreateOperationMutation);

  const { collections, loading } = useCollections();

  const { queryEditor, variableEditor, headerEditor } = useEditorContext({
    nonNull: true,
  });

  const { error } = mutationCreate;

  const fetching = loading;

  const {
    handleSubmit,
    values,
    handleChange,
    handleBlur,
    errors,
    isValid,
    touched,
    isSubmitting,
    resetForm,
  } = useFormik({
    initialValues: {
      name: '',
      collectionId: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().min(3).required(),
      collectionId: Yup.string().required('Collection is a required field'),
    }),
    async onSubmit(values) {
      const { error, data: result } = await mutateCreate({
        selector: {
          target: router.targetId,
          organization: router.organizationId,
          project: router.projectId,
        },
        input: {
          name: values.name,
          collectionId: values.collectionId,
          query: queryEditor?.getValue(),
          variables: variableEditor?.getValue(),
          headers: headerEditor?.getValue(),
        },
      });
      if (!error) {
        if (result) {
          const data = result.createOperationInDocumentCollection;
          // quick fix because router.push provoke infinity network requests due
          // `pause: !router.query.operation` in `useQuery` urql hook
          window.location.search = `operation=${data.ok?.operation.id}`;
          // void router.push({
          //   query: {
          //     ...router.query,
          //     operation: data.ok?.operation.id,
          //   },
          // });
        }
        resetForm();
        toggleModalOpen();
      }
    },
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      {!fetching && (
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          <Heading className="text-center">Create Operation</Heading>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="name">
              Operation Name
            </label>
            <Input
              name="name"
              placeholder="Your Operation Name"
              value={values.name}
              onChange={handleChange}
              onBlur={handleBlur}
              isInvalid={!!(touched.name && errors.name)}
              data-cy="input.name"
            />
            {touched.name && errors.name && (
              <div className="text-sm text-red-500">{errors.name}</div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="name">
              Which collection would you like to save this operation to?
            </label>
            <Select
              name="collectionId"
              placeholder="Select collection"
              options={collections?.map(c => ({
                value: c.id,
                name: c.name,
              }))}
              value={values.collectionId}
              onChange={handleChange}
              onBlur={handleBlur}
              isInvalid={!!(touched.collectionId && errors.collectionId)}
              data-cy="select.collectionId"
            />
            {touched.collectionId && errors.collectionId && (
              <div className="text-sm text-red-500">{errors.collectionId}</div>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error.message}</div>}

          <div className="flex w-full gap-2">
            <Button
              type="button"
              size="large"
              block
              onClick={() => {
                resetForm();
                toggleModalOpen();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              disabled={isSubmitting || !isValid || values.collectionId === ''}
              data-cy="confirm"
            >
              Add Operation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
