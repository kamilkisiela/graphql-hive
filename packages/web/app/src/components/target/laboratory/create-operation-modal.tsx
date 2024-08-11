import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useCollections } from '@/lib/hooks/laboratory/use-collections';
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

export function CreateOperationModal(props: {
  isOpen: boolean;
  close: () => void;
  onSaveSuccess: (args: { id: string; name: string }) => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
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
    setFieldValue,
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
        resetForm();
        close();
      }
    },
  });

  return (
    <Modal open={isOpen} onOpenChange={close}>
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
              value={values.collectionId}
              onValueChange={async v => {
                await setFieldValue('collectionId', v);
              }}
            >
              <SelectTrigger>
                {collections.find(c => c.id === values.collectionId)?.name || 'Select collection'}
              </SelectTrigger>
              <SelectContent className="w-[--radix-select-trigger-width]">
                {collections.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <div className="mt-1 line-clamp-1 text-xs opacity-50">{c.description}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched.collectionId && errors.collectionId && (
              <div className="text-sm text-red-500">{errors.collectionId}</div>
            )}
          </div>

          {mutationCreate.error && (
            <div className="text-sm text-red-500">{mutationCreate.error.message}</div>
          )}

          <div className="flex w-full gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full justify-center"
              onClick={() => {
                resetForm();
                close();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full justify-center"
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
