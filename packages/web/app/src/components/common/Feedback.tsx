import 'twin.macro';
import * as React from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
} from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { SendFeedbackDocument } from '@/graphql';

export const Feedback: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  const [mutation, mutate] = useMutation(SendFeedbackDocument);
  const [state, setState] = React.useState<'FORM' | 'THANK_YOU'>('FORM');
  const formik = useFormik({
    initialValues: {
      feedback: '',
    },
    validationSchema: Yup.object().shape({
      feedback: Yup.string()
        .min(1)
        .required(`Hey hey hey, you opened the feedback modal and won't even say Hi?`),
    }),
    async onSubmit(values) {
      if (formik.isValid && !mutation.fetching) {
        await mutate({
          feedback: values.feedback,
        });
        setState('THANK_YOU');
        formik.resetForm();
      }
    },
  });

  const isValid = React.useCallback(
    (name: keyof typeof formik.errors) => {
      return formik.touched[name] && !!formik.errors[name];
    },
    [formik],
  );

  const sending = mutation.fetching;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeOnEsc={false}
      closeOnOverlayClick={false}
    >
      <ModalOverlay />
      <ModalContent
        as="form"
        // Chakra does not let us use the correct type signature/formik is to strict in it's types.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        onSubmit={formik.handleSubmit}
      >
        <ModalHeader>{state === 'FORM' ? 'Send feedback' : 'We got your feedback'}</ModalHeader>
        <ModalBody>
          {state === 'FORM' ? (
            <div tw="space-y-6">
              <FormControl isInvalid={isValid('feedback')}>
                <FormLabel>How can we improve GraphQL Hive?</FormLabel>
                <Textarea
                  name="feedback"
                  value={formik.values.feedback}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={sending}
                />
                <FormErrorMessage>{formik.errors.feedback}</FormErrorMessage>
              </FormControl>
            </div>
          ) : (
            <Alert
              status="success"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              height="200px"
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={1} fontSize="lg">
                Thank you!
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                We sincerely appreciate your comment because it helps us improve GraphQL Hive.
              </AlertDescription>
            </Alert>
          )}
        </ModalBody>
        <ModalFooter tw="space-x-6">
          {state === 'FORM' ? (
            <>
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="primary"
                type="submit"
                isLoading={sending}
                disabled={sending || !formik.isValid}
              >
                Send feedback
              </Button>
            </>
          ) : (
            <Button
              colorScheme="primary"
              type="button"
              onClick={() => {
                onClose();
                setState('FORM');
              }}
            >
              Ok, back to Hive
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
