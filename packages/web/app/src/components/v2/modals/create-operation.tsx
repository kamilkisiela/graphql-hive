import { ReactElement, useEffect } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal, Select } from '@/components/v2';
import { CreateOperationDocument, OperationDocument, UpdateOperationDocument } from '@/graphql';
import { useCollections } from '@/lib/hooks/use-collections';
import { useEditorContext } from '@graphiql/react';

export function CreateOperationModal({
  isOpen,
  toggleModalOpen,
  operationId,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  operationId?: string;
}): ReactElement {
  const [mutationCreate, mutateCreate] = useMutation(CreateOperationDocument);
  const [mutationUpdate, mutateUpdate] = useMutation(UpdateOperationDocument);

  const { collections, loading } = useCollections();

  const { queryEditor, variableEditor, headerEditor } = useEditorContext({
    nonNull: true,
  });

  const [{ data, error: operationError, fetching: loadingOperation }] = useQuery({
    query: OperationDocument,
    variables: {
      id: operationId!,
    },
    pause: !operationId,
  });
  const error = mutationCreate.error || mutationUpdate.error || operationError;

  const fetching = loading || loadingOperation;

  useEffect(() => {
    if (data) {
      const { operation } = data;
      void setValues({
        name: operation.name,
        collectionId: operation.collection.id,
      });
    }
  }, [data]);

  const {
    handleSubmit,
    values,
    handleChange,
    errors,
    isValid,
    touched,
    isSubmitting,
    setValues,
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
      const { error } =
        operationId && data?.operation
          ? await mutateUpdate({
              input: {
                ...values,
                query: data.operation.query,
                variables: data.operation.variables,
                headers: data.operation.headers,
                id: operationId,
              },
            })
          : await mutateCreate({
              input: {
                ...values,
                query: queryEditor?.getValue(),
                variables: variableEditor?.getValue(),
                headers: headerEditor?.getValue(),
              },
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
          <Heading className="text-center">Save Operation</Heading>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="name">
              Operation Name
            </label>
            <Input
              name="name"
              placeholder="Your Operation Name"
              value={values.name}
              onChange={handleChange}
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
              isInvalid={!!(touched.collectionId && errors.collectionId)}
              data-cy="select.collectionId"
            />
            {touched.collectionId && errors.collectionId && (
              <div className="text-sm text-red-500">{errors.collectionId}</div>
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
              disabled={isSubmitting || !isValid || values.collectionId === ''}
              data-cy="confirm"
            >
              {operationId ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
