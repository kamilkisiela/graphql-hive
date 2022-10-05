import * as React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  FormLabel,
} from '@chakra-ui/react';
import { FragmentType, graphql, useFragment } from '@/gql';

const UpdateMeFragment = graphql(/* GraphQL */ `
  fragment UpdateMeFragment on User {
    id
    fullName
    displayName
  }
`);

const UpdateMeMutation = graphql(/* GraphQL */ `
  mutation UserSettings_UpdateMeMutation($input: UpdateMeInput!) {
    updateMe(input: $input) {
      ok {
        updatedUser {
          ...UpdateMeFragment
          fullName
          displayName
        }
      }
    }
  }
`);

export const UserSettings: React.FC<{
  me: FragmentType<typeof UpdateMeFragment>;
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose, ...props }) => {
  const me = useFragment(UpdateMeFragment, props.me);
  const [mutation, mutate] = useMutation(UpdateMeMutation);
  const formik = useFormik({
    initialValues: {
      fullName: me.fullName,
      displayName: me.displayName,
    },
    validationSchema: Yup.object().shape({
      fullName: Yup.string().min(1).required(`Full name is required`),
      displayName: Yup.string().min(1).required(`Display name is required`),
    }),
    async onSubmit(values) {
      if (formik.isValid && !mutation.fetching) {
        const { data } = await mutate({
          input: values,
        });

        if (data?.updateMe?.ok) {
          formik.resetForm({
            values: {
              fullName: data.updateMe.ok.updatedUser.fullName,
              displayName: data.updateMe.ok.updatedUser.displayName,
            },
          });
        } else {
          formik.resetForm();
        }
      }
    },
  });

  const isValid = React.useCallback(
    (name: keyof typeof formik.errors) => {
      return formik.touched[name] && !!formik.errors[name];
    },
    [formik]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnEsc={false} closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent
        as="form"
        // Chakra does not let us use the correct type signature/formik is to strict in it's types.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        onSubmit={formik.handleSubmit}
      >
        <ModalHeader>User Settings</ModalHeader>
        <ModalBody>
          <div tw="space-y-6">
            <FormControl isInvalid={isValid('fullName')}>
              <FormLabel>Full name</FormLabel>
              <Input
                name="fullName"
                value={formik.values.fullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={formik.isSubmitting}
              />
              <FormErrorMessage>{formik.errors.fullName}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={isValid('displayName')}>
              <FormLabel>Display name</FormLabel>
              <Input
                name="displayName"
                value={formik.values.displayName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={formik.isSubmitting}
              />
              <FormErrorMessage>{formik.errors.displayName}</FormErrorMessage>
            </FormControl>
          </div>
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button variant="ghost" type="button" disabled={formik.isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            type="submit"
            loadingText="Saving"
            isLoading={formik.isSubmitting}
            disabled={formik.isSubmitting || !formik.isValid}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
