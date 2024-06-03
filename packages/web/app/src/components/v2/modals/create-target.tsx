import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, Modal } from '@/components/v2';
import { graphql } from '@/gql';
import { useRouter } from '@tanstack/react-router';

export const CreateTarget_CreateTargetMutation = graphql(`
  mutation CreateTarget_CreateTarget($input: CreateTargetInput!) {
    createTarget(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        createdTarget {
          id
          cleanId
          name
        }
      }
      error {
        message
        inputErrors {
          name
        }
      }
    }
  }
`);

export const CreateTargetModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen } = props;
  const [mutation, mutate] = useMutation(CreateTarget_CreateTargetMutation);
  const router = useRouter();

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      initialValues: { name: '' },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Target name is required'),
      }),
      async onSubmit(values) {
        const { projectId, organizationId } = props;
        const { data } = await mutate({
          input: {
            project: projectId,
            organization: organizationId,
            name: values.name,
          },
        });
        if (data?.createTarget.ok) {
          toggleModalOpen();
          const targetId = data.createTarget.ok.createdTarget.cleanId;
          void router.navigate({
            to: '/$organizationId/$projectId/$targetId',
            params: {
              organizationId,
              projectId,
              targetId,
            },
          });
        }
      },
    });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Heading className="text-center">Create a new target</Heading>
        <p className="text-sm text-gray-500">
          A project is build on top of <b>Targets</b>, which are just your environments.
        </p>
        <Input
          placeholder="Target name"
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
        {mutation.data?.createTarget.error?.inputErrors.name && (
          <div className="-mt-2 text-sm text-red-500">
            {mutation.data.createTarget.error.inputErrors.name}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full justify-center"
            onClick={toggleModalOpen}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="w-full justify-center"
            variant="primary"
            disabled={isSubmitting}
          >
            Create Target
          </Button>
        </div>
      </form>
    </Modal>
  );
};
