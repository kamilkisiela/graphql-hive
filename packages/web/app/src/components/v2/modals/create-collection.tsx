import { ReactElement, useEffect } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Button, Checkbox, Heading, Input, Modal } from '@/components/v2';
import {
  CollectionDocument,
  CreateCollectionDocument,
  TargetDocument,
  UpdateCollectionDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

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
  const [mutationCreate, mutateCreate] = useMutation(CreateCollectionDocument);
  const [mutationUpdate, mutateUpdate] = useMutation(UpdateCollectionDocument);

  const [result] = useQuery({
    query: TargetDocument,
    variables: {
      targetId: router.targetId,
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
  });

  const [{ data, error: collectionError, fetching: loadingCollection }] = useQuery({
    query: CollectionDocument,
    variables: {
      id: collectionId!,
    },
    pause: !collectionId,
  });

  const error = mutationCreate.error || result.error || collectionError || mutationUpdate.error;
  const fetching = loadingCollection || result.fetching;

  useEffect(() => {
    if (!collectionId) {
      resetForm();
    } else if (data) {
      const { collection } = data;
      void setValues({
        name: collection.name,
        description: collection.description || '',
        canBeEditedByViewer: collection.canBeEditedByViewer,
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
    setFieldValue,
    setValues,
    resetForm,
  } = useFormik({
    initialValues: {
      name: '',
      description: '',
      canBeEditedByViewer: false,
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().required(),
      description: Yup.string(),
      canBeEditedByViewer: Yup.boolean().required(),
    }),
    async onSubmit(values) {
      const targetId = result.data?.target?.id;
      if (!targetId) throw new Error('No targetId found');
      const { error } = collectionId
        ? await mutateUpdate({
            input: {
              id: collectionId,
              ...values,
            },
          })
        : await mutateCreate({
            input: {
              targetId,
              ...values,
            },
          });
      if (!error) {
        toggleModalOpen();
      }
    },
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      {!fetching && (
        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          <Heading className="text-center">Create Shared Collection</Heading>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="name">
              Collection Name
            </label>
            <Input
              data-cy='input.name'
              name="name"
              placeholder="Your Shared Collection"
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
              data-cy='input.description'
              name="description"
              value={values.description}
              onChange={handleChange}
              isInvalid={!!(touched.description && errors.description)}
            />
            {touched.description && errors.description && (
              <div className="text-sm text-red-500">{errors.description}</div>
            )}
          </div>

          <div className="flex gap-4">
            <Checkbox
              id="canBeEditedByViewer"
              checked={values.canBeEditedByViewer}
              onCheckedChange={checked => setFieldValue('canBeEditedByViewer', checked)}
            />
            <label className="text-sm" htmlFor="canBeEditedByViewer">
              Allow non admin members of this organization to create, update or delete
            </label>
            {touched.canBeEditedByViewer && errors.canBeEditedByViewer && (
              <div className="text-sm text-red-500">{errors.canBeEditedByViewer}</div>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error.message}</div>}

          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={toggleModalOpen}>
              Cancel
            </Button>
            <Button type="submit" size="large" block variant="primary" disabled={isSubmitting} data-cy="confirm">
              {collectionId ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
