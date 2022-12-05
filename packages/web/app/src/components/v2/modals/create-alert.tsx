import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import { Button, Heading, Modal, Select } from '@/components/v2';
import { AddAlertDocument, AlertChannelsDocument, AlertType, TargetsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks';

export const CreateAlertModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const [mutation, mutate] = useMutation(AddAlertDocument);
  const router = useRouteSelector();
  const [targetsQuery] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });
  const [channelsQuery] = useQuery({
    query: AlertChannelsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const channels = channelsQuery.data?.alertChannels || [];
  const targets = targetsQuery.data?.targets.nodes || [];

  const { handleSubmit, values, handleChange, errors, touched, isSubmitting } = useFormik({
    initialValues: {
      type: AlertType.SchemaChangeNotifications,
      channel: '',
      target: '',
    },
    validationSchema: Yup.object().shape({
      type: Yup.string().equals([AlertType.SchemaChangeNotifications]).required('Must select type'),
      channel: Yup.lazy(() =>
        Yup.string()
          .min(1)
          .equals(channels.map(channel => channel.id))
          .required('Must select channel'),
      ),
      target: Yup.lazy(() =>
        Yup.string()
          .min(1)
          .equals(targets.map(target => target.cleanId))
          .required('Must select target'),
      ),
    }),
    async onSubmit(values) {
      const { error } = await mutate({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: values.target,
          channel: values.channel,
          type: values.type,
        },
      });
      if (!error) {
        toggleModalOpen();
      }
    },
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <Heading className="text-center">Create an alert</Heading>

        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Type
          </label>
          <Select
            name="type"
            placeholder="Select alert type"
            options={[
              {
                value: AlertType.SchemaChangeNotifications,
                name: 'Schema Change Notifications',
              },
            ]}
            value={values.type}
            onChange={handleChange}
            isInvalid={Boolean(touched.type && errors.type)}
          />
          {touched.type && errors.type && <div className="text-sm text-red-500">{errors.type}</div>}
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Channel
          </label>
          <Select
            name="channel"
            placeholder="Select channel"
            options={channels.map(channel => ({
              value: channel.id,
              name: channel.name,
            }))}
            value={values.channel}
            onChange={handleChange}
            isInvalid={Boolean(touched.channel && errors.channel)}
          />
          {touched.channel && errors.channel && (
            <div className="text-sm text-red-500">{errors.channel}</div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Target
          </label>
          <Select
            name="target"
            placeholder="Select target"
            options={targets.map(target => ({
              value: target.cleanId,
              name: target.name,
            }))}
            value={values.target}
            onChange={handleChange}
            isInvalid={Boolean(touched.target && errors.target)}
          />
          {touched.target && errors.target && (
            <div className="text-sm text-red-500">{errors.target}</div>
          )}
        </div>

        {mutation.error && <div className="text-sm text-red-500">{mutation.error.message}</div>}

        <div className="flex w-full gap-2">
          <Button type="button" size="large" block onClick={toggleModalOpen}>
            Cancel
          </Button>
          <Button type="submit" size="large" block variant="primary" disabled={isSubmitting}>
            Create Alert
          </Button>
        </div>
      </form>
    </Modal>
  );
};
