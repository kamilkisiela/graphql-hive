import { useRouter } from 'next/router';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Spinner } from '@/components/v2';
import { graphql } from '@/gql';

export const CreateOrganizationMutation = graphql(`
  mutation CreateOrganizationMutation($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      ok {
        createdOrganizationPayload {
          selector {
            organization
          }
          organization {
            cleanId
            ...OrganizationFields
          }
        }
      }
      error {
        inputErrors {
          name
        }
      }
    }
  }
`);

export const CreateOrganizationForm = () => {
  const [mutation, mutate] = useMutation(CreateOrganizationMutation);
  const { push } = useRouter();
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched, isValid } =
    useFormik({
      initialValues: { name: '' },
      validationSchema: Yup.object().shape({
        name: Yup.string()
          .min(2, 'Name must be at least 2 characters long')
          .max(50, 'Name must be at most 50 characters long')
          .matches(
            /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
            'Name restricted to alphanumerical characters, spaces and . , _ - / &',
          )
          .required('Organization name is required'),
      }),
      async onSubmit(values) {
        const mutation = await mutate({
          input: {
            name: values.name,
          },
        });

        if (mutation.data?.createOrganization.ok) {
          void push(
            `/${mutation.data.createOrganization.ok.createdOrganizationPayload.organization.cleanId}`,
          );
        }
      },
    });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Heading className="text-center">Create an organization</Heading>
      <p className="text-sm text-gray-500">
        An organization is built on top of <b>Projects</b>. You will become an <b>admin</b> and
        don't worry, you can add members later.
      </p>
      <Input
        placeholder="Organization name"
        name="name"
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={isSubmitting}
        isInvalid={touched.name && !!errors.name}
        className="grow"
      />
      {touched.name && (errors.name || mutation.error) && (
        <div className="-mt-2 text-sm text-red-500">{errors.name || mutation.error?.message}</div>
      )}
      {mutation.data?.createOrganization.error?.inputErrors.name && (
        <div className="-mt-2 text-sm text-red-500">
          {mutation.data.createOrganization.error.inputErrors.name}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="large"
          block
          variant="primary"
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? (
            <>
              <Spinner className="size-6 text-white" />
              <span className="ml-4">Creating...</span>
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </div>
    </form>
  );
};
