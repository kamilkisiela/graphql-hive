import { ReactElement, useMemo } from 'react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useCollections } from '@/lib/hooks/laboratory/use-collections';
import { useEditorContext } from '@graphiql/react';

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
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const [updateOperationNameState, mutate] = useMutation(UpdateOperationNameMutation);
  const { collections } = useCollections({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
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
            target: props.targetId,
            organization: props.organizationId,
            project: props.projectId,
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

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="lg" onClick={props.close}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
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
