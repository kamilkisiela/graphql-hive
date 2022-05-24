import * as React from 'react';
import 'twin.macro';
import { VscRadioTower } from 'react-icons/vsc';
import { useMutation } from 'urql';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  Code,
  Input,
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { AddAlertChannelDocument, AlertChannelType } from '@/graphql';
import { useTracker } from '@/lib/hooks/use-tracker';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const ChannelCreator: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  useTracker('ALERT_CHANNEL_CREATOR', isOpen);
  const router = useRouteSelector();
  const [mutation, mutate] = useMutation(AddAlertChannelDocument);
  const formik = useFormik({
    initialValues: {
      name: '',
      type: '',
      slackChannel: '',
      endpoint: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().min(0).required('Must enter name'),
      type: Yup.string().equals([AlertChannelType.Slack, AlertChannelType.Webhook]).required('Must select type'),
      slackChannel: Yup.string()
        .matches(/^[@#]{1}/)
        .min(0)
        .when('type', {
          is: AlertChannelType.Slack,
          then: Yup.string().required('Must enter slack channel'),
        }),
      endpoint: Yup.string()
        .url()
        .when('type', {
          is: AlertChannelType.Webhook,
          then: Yup.string().required('Must enter endpoint'),
        }),
    }),
    async onSubmit(values) {
      if (formik.isValid && !mutation.fetching) {
        mutate({
          input: {
            organization: router.organizationId,
            project: router.projectId,
            name: values.name,
            type: values.type as any,
            slack:
              values.type === AlertChannelType.Slack
                ? {
                    channel: values.slackChannel,
                  }
                : null,
            webhook:
              values.type === AlertChannelType.Webhook
                ? {
                    endpoint: values.endpoint,
                  }
                : null,
          },
        }).finally(() => {
          onClose();
          formik.resetForm();
        });
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
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={formik.handleSubmit}>
        <ModalHeader>Create a channel</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <div tw="pt-6 space-y-6">
            <FormControl isInvalid={isValid('name')}>
              <FormLabel>Name</FormLabel>
              <Input
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Example: Slack #hives"
                type="text"
              />
              <FormHelperText>
                This will be displayed on channels list, we recommend to make it self-explanatory.
              </FormHelperText>
              <FormErrorMessage>{formik.errors.name}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={isValid('type')}>
              <FormLabel>Type</FormLabel>
              <Select
                name="type"
                value={formik.values.type}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Select channel type"
              >
                <option value={AlertChannelType.Slack}>Slack</option>
                <option value={AlertChannelType.Webhook}>Webhook</option>
              </Select>
              <FormErrorMessage>{formik.errors.type}</FormErrorMessage>
            </FormControl>
            {formik.values.type === 'WEBHOOK' && (
              <FormControl isInvalid={isValid('endpoint')}>
                <FormLabel>Endpoint</FormLabel>
                <Input
                  name="endpoint"
                  value={formik.values.endpoint}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Your endpoint"
                  type="text"
                />
                <FormHelperText>Hive will send alerts to your endpoint.</FormHelperText>
                <FormErrorMessage>{formik.errors.endpoint}</FormErrorMessage>
              </FormControl>
            )}
            {formik.values.type === 'SLACK' && (
              <FormControl isInvalid={isValid('slackChannel')}>
                <FormLabel>Slack Channel</FormLabel>
                <Input
                  name="slackChannel"
                  value={formik.values.slackChannel}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Where should Hive post messages?"
                  type="text"
                />
                <FormHelperText>
                  Use <Code>#channel</Code> or <Code>@username</Code> form.
                </FormHelperText>
                <FormErrorMessage>{formik.errors.slackChannel}</FormErrorMessage>
              </FormControl>
            )}
          </div>
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button variant="ghost" type="button" onClick={onClose} disabled={mutation.fetching}>
            Cancel
          </Button>
          <Button colorScheme="primary" type="submit" isLoading={mutation.fetching} disabled={!formik.isValid}>
            Create Channel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const ChannelCreatorTrigger: React.FC = () => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button leftIcon={<VscRadioTower />} colorScheme="teal" variant="ghost" size="sm" onClick={open}>
        Add channel
      </Button>
      <ChannelCreator isOpen={isOpen} onClose={onClose} />
    </>
  );
};
