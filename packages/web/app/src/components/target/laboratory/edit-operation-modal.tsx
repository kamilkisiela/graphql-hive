import { ReactElement, useMemo } from 'react';
import { useFormik } from 'formik';
import { useCollections } from 'packages/web/app/pages/[organizationId]/[projectId]/[targetId]/laboratory';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';

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

export const EditOperationModal = (props: {
  operationId: string;
  close: () => void;
}): ReactElement => {
  const router = useRouteSelector();
  const [updateOperationNameState, mutate] = useMutation(UpdateOperationNameMutation);
  const { collections } = useCollections();

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

  const { handleSubmit, values, handleChange, handleBlur, errors, isValid, touched, isSubmitting } =
    useFormik({
      initialValues: {
        name: operation?.name ?? '',
        collectionId: collection?.id ?? '',
      },
      validationSchema: Yup.object().shape({
        name: Yup.string().min(3).required(),
        collectionId: Yup.string().required('Collection is a required field'),
      }),
      async onSubmit(values) {
        const response = await mutate({
          selector: {
            target: router.targetId,
            organization: router.organizationId,
            project: router.projectId,
          },
          input: {
            collectionId: values.collectionId,
            operationId: props.operationId,
            name: values.name,
          },
        });
        const error = response.error || response.data?.updateOperationInDocumentCollection?.error;

        if (!error) {
          props.close();
        }
      },
    });

  return (
    <Modal open onOpenChange={props.close} className="flex flex-col items-center gap-5">
      {!updateOperationNameState.fetching && (
        <form className="flex w-full flex-col gap-8" onSubmit={handleSubmit}>
          <Heading className="text-center">Edit Operation</Heading>

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

          {updateOperationNameState.error && (
            <div className="text-sm text-red-500">{updateOperationNameState.error.message}</div>
          )}

          <div className="flex w-full gap-2">
            <Button
              type="button"
              size="large"
              block
              onClick={() => {
                close();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              disabled={isSubmitting || !isValid}
              data-cy="confirm"
            >
              Update Operation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
