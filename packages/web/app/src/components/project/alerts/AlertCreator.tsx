import * as React from 'react';
import 'twin.macro';
import { VscBell } from 'react-icons/vsc';
import { useMutation, useQuery } from 'urql';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
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
import {
  AddAlertDocument,
  AlertChannelsDocument,
  AlertType,
  TargetsDocument,
} from '@/graphql';
import { useTracker } from '@/lib/hooks/use-tracker';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const AlertCreator: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  useTracker('ALERT_CREATOR', isOpen);
  const router = useRouteSelector();
  const [targetsQuery] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
  });
  const [channelsQuery] = useQuery({
    query: AlertChannelsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
  });
  const [mutation, mutate] = useMutation(AddAlertDocument);

  const channels =
    channelsQuery.data?.alertChannels?.map((channel) => channel.id) || [];
  const targets =
    targetsQuery.data?.targets.nodes?.map((target) => target.cleanId) || [];

  const formik = useFormik({
    initialValues: {
      type: AlertType.SchemaChangeNotifications,
      channel: '',
      target: '',
    },
    validationSchema: Yup.object().shape({
      type: Yup.string()
        .equals([AlertType.SchemaChangeNotifications])
        .required('Must select type'),
      channel: Yup.lazy(() =>
        Yup.string().min(1).equals(channels).required('Must select channel')
      ),
      target: Yup.lazy(() =>
        Yup.string().min(1).equals(targets).required('Must select target')
      ),
    }),
    async onSubmit(values) {
      if (formik.isValid && !mutation.fetching) {
        mutate({
          input: {
            organization: router.organizationId,
            project: router.projectId,
            target: values.target,
            channel: values.channel,
            type: values.type as any,
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
        <ModalHeader>Create an alert</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <div tw="pt-6 space-y-6">
            <FormControl isInvalid={isValid('type')}>
              <FormLabel>Type</FormLabel>
              <Select
                name="type"
                value={formik.values.type}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Select alert type..."
              >
                <option value={AlertType.SchemaChangeNotifications}>
                  Schema Change Notifications
                </option>
              </Select>
              <FormErrorMessage>{formik.errors.type}</FormErrorMessage>
            </FormControl>
            <FormControl
              isInvalid={isValid('channel')}
              isDisabled={channelsQuery.fetching || !!channelsQuery.error}
            >
              <FormLabel>Channel</FormLabel>
              <Select
                name="channel"
                value={formik.values.channel}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Pick channel..."
              >
                {channelsQuery.data?.alertChannels?.map((channel) => {
                  return (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  );
                })}
              </Select>
              <FormErrorMessage>{formik.errors.channel}</FormErrorMessage>
            </FormControl>
            <FormControl
              isInvalid={isValid('target')}
              isDisabled={targetsQuery.fetching || !!targetsQuery.error}
            >
              <FormLabel>Target</FormLabel>
              <Select
                name="target"
                value={formik.values.target}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Select target..."
              >
                {targetsQuery.data?.targets?.nodes.map((target) => {
                  return (
                    <option key={target.cleanId} value={target.cleanId}>
                      {target.name}
                    </option>
                  );
                })}
              </Select>
              <FormErrorMessage>{formik.errors.target}</FormErrorMessage>
            </FormControl>
          </div>
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={mutation.fetching}
          >
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            type="submit"
            disabled={!formik.isValid}
            isLoading={mutation.fetching}
          >
            Create Alert
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const AlertCreatorTrigger: React.FC = () => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button
        leftIcon={<VscBell />}
        colorScheme="teal"
        variant="ghost"
        size="sm"
        onClick={open}
      >
        Create alert
      </Button>
      <AlertCreator isOpen={isOpen} onClose={onClose} />
    </>
  );
};
