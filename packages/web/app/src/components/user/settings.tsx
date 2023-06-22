import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';

const UserSettings_MeQuery = graphql(`
  query UserSettings_MeQuery {
    me {
      id
      fullName
      displayName
      canSwitchOrganization
    }
  }
`);

const UpdateMeMutation = graphql(`
  mutation updateMe($input: UpdateMeInput!) {
    updateMe(input: $input) {
      ok {
        updatedUser {
          id
          fullName
          displayName
        }
      }
      error {
        message
        inputErrors {
          fullName
          displayName
        }
      }
    }
  }
`);

export function UserSettingsModal({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement {
  const [meQuery] = useQuery({ query: UserSettings_MeQuery });
  const [mutation, mutate] = useMutation(UpdateMeMutation);

  const me = meQuery.data?.me;

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        fullName: me?.fullName || '',
        displayName: me?.displayName || '',
      },
      validationSchema: Yup.object().shape({
        fullName: Yup.string().required('Full name is required'),
        displayName: Yup.string().required('Display name is required'),
      }),
      onSubmit: async values => {
        const { data } = await mutate({ input: values });
        if (data?.updateMe.ok) {
          toggleModalOpen();
        }
      },
    });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Heading>Profile settings</Heading>
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Full name
          </label>
          <Input
            placeholder="Full name"
            name="fullName"
            value={values.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.fullName && !!errors.fullName}
          />
          {touched.fullName && errors.fullName && (
            <span className="text-red-500">{errors.fullName}</span>
          )}
          {mutation.data?.updateMe.error?.inputErrors.fullName && (
            <span className="text-red-500">
              {mutation.data.updateMe.error.inputErrors.fullName}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Display name
          </label>
          <Input
            placeholder="Display name"
            name="displayName"
            value={values.displayName}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.displayName && !!errors.displayName}
          />
          {touched.displayName && errors.displayName && (
            <span className="text-red-500">{errors.displayName}</span>
          )}
          {mutation.data?.updateMe.error?.inputErrors.displayName && (
            <span className="text-red-500">
              {mutation.data.updateMe.error.inputErrors.displayName}
            </span>
          )}
        </div>

        {mutation.error && <span className="text-red-500">{mutation.error.message}</span>}
        {mutation.data?.updateMe.error?.message && (
          <span className="text-red-500">{mutation.data.updateMe.error.message}</span>
        )}

        <Button type="submit" variant="primary" size="large" block disabled={isSubmitting}>
          Save Changes
        </Button>
      </form>
    </Modal>
  );
}
