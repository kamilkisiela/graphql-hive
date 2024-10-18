import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, Modal, Select, Tag } from '@/components/v2';
import { graphql } from '@/gql';
import { AlertChannelType } from '@/gql/graphql';

export const CreateChannel_AddAlertChannelMutation = graphql(`
  mutation CreateChannel_AddAlertChannel($input: AddAlertChannelInput!) {
    addAlertChannel(input: $input) {
      ok {
        updatedProject {
          id
        }
        addedAlertChannel {
          ...ChannelsTable_AlertChannelFragment
        }
      }
      error {
        message
        inputErrors {
          webhookEndpoint
          slackChannel
          name
        }
      }
    }
  }
`);

export const CreateChannelModal = ({
  isOpen,
  toggleModalOpen,
  organizationSlug,
  projectSlug,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
  projectSlug: string;
}): ReactElement => {
  const [mutation, mutate] = useMutation(CreateChannel_AddAlertChannelMutation);
  const { errors, values, touched, handleChange, handleBlur, handleSubmit, isSubmitting } =
    useFormik({
      initialValues: {
        name: '',
        type: '' as AlertChannelType,
        slackChannel: '',
        endpoint: '',
      },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Must enter name'),
        type: Yup.mixed().oneOf(Object.values(AlertChannelType)).required('Must select type'),
        slackChannel: Yup.string()
          .matches(/^[@#]{1}/, 'Must start with a @ or # character')
          .when('type', ([type], schema) =>
            type === AlertChannelType.Slack ? schema.required('Must enter slack channel') : schema,
          ),
        endpoint: Yup.string()
          .url()
          .when('type', ([_type], schema) =>
            isWebhookLike ? schema.required('Must enter endpoint') : schema,
          ),
      }),
      async onSubmit(values) {
        const { data, error } = await mutate({
          input: {
            organizationSlug,
            projectSlug,
            name: values.name,
            type: values.type,
            slack: values.type === AlertChannelType.Slack ? { channel: values.slackChannel } : null,
            webhook: isWebhookLike ? { endpoint: values.endpoint } : null,
          },
        });
        if (error) {
          console.error(error);
        }
        if (data?.addAlertChannel.error) {
          console.error(data.addAlertChannel.error);
        }
        if (data?.addAlertChannel.ok) {
          toggleModalOpen();
        }
      },
    });
  const isWebhookLike = [AlertChannelType.Webhook, AlertChannelType.MsteamsWebhook].includes(
    values.type,
  );

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen}>
      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <Heading>Create a channel</Heading>
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Name
          </label>
          <Input
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Example: Slack #hives"
            disabled={isSubmitting}
            isInvalid={touched.name && !!errors.name}
            className="grow"
          />
          {touched.name && errors.name && <div className="text-sm text-red-500">{errors.name}</div>}
          {mutation.data?.addAlertChannel.error?.inputErrors.name && (
            <div className="text-sm text-red-500">
              {mutation.data.addAlertChannel.error.inputErrors.name}
            </div>
          )}
          <p className="text-sm text-gray-500">
            This will be displayed on channels list, we recommend to make it self-explanatory.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold" htmlFor="name">
            Type
          </label>
          <Select
            name="type"
            value={values.type}
            onChange={handleChange}
            onBlur={handleBlur}
            isInvalid={!!(touched.type && errors.type)}
            placeholder="Select channel type"
            options={[
              { value: AlertChannelType.Slack, name: 'Slack' },
              { value: AlertChannelType.Webhook, name: 'Webhook' },
              { value: AlertChannelType.MsteamsWebhook, name: 'MS Teams Webhook' },
            ]}
          />
          {touched.type && errors.type && <div className="text-sm text-red-500">{errors.type}</div>}
        </div>

        {isWebhookLike && (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="endpoint">
              Endpoint
            </label>
            <Input
              name="endpoint"
              value={values.endpoint}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Your endpoint"
              disabled={isSubmitting}
              isInvalid={touched.endpoint && !!errors.endpoint}
              className="grow"
            />
            {touched.endpoint && errors.endpoint && (
              <div className="text-sm text-red-500">{errors.endpoint}</div>
            )}
            {mutation.data?.addAlertChannel.error?.inputErrors.webhookEndpoint && (
              <div className="text-sm text-red-500">
                {mutation.data.addAlertChannel.error.inputErrors.webhookEndpoint}
              </div>
            )}
            {values.endpoint ? (
              <p className="text-sm text-gray-500">Hive will send alerts to your endpoint.</p>
            ) : (
              <a href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet">
                Follow this guide to set up an incoming webhook connector in MS Teams
              </a>
            )}
          </div>
        )}

        {values.type === AlertChannelType.Slack && (
          <div className="flex flex-col gap-4">
            <label className="text-sm font-semibold" htmlFor="endpoint">
              Slack Channel
            </label>
            <Input
              name="slackChannel"
              value={values.slackChannel}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Where should Hive post messages?"
              disabled={isSubmitting}
              isInvalid={touched.slackChannel && !!errors.slackChannel}
              className="grow"
            />
            {touched.slackChannel && errors.slackChannel && (
              <div className="text-sm text-red-500">{errors.slackChannel}</div>
            )}
            {mutation.data?.addAlertChannel.error?.inputErrors.slackChannel && (
              <div className="text-sm text-red-500">
                {mutation.data.addAlertChannel.error.inputErrors.slackChannel}
              </div>
            )}
            <p className="text-sm text-gray-500">
              Use <Tag>#channel</Tag> or <Tag>@username</Tag> form.
            </p>
          </div>
        )}

        <div className="flex w-full gap-2">
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
            className="w-full justify-center text-ellipsis whitespace-nowrap"
            variant="primary"
            disabled={isSubmitting}
          >
            Create Channel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
