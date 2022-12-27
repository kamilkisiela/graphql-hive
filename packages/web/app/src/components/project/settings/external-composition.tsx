import { useCallback, useState } from 'react';
import { useFormik } from 'formik';
import { gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import { Button, Card, Heading, Input, Spinner, Switch } from '@/components/v2';
import { OrganizationFieldsFragment, ProjectFieldsFragment } from '@/graphql';
import { useNotifications } from '@/lib/hooks';

export const ExternalCompositionForm_EnableMutation = gql(`
  mutation ExternalCompositionForm_EnableMutation($input: EnableExternalSchemaCompositionInput!) {
    enableExternalSchemaComposition(input: $input) {
      ok {
        endpoint
      }
      error {
        message
        inputErrors {
          endpoint
          secret
        }
      }
    }
  }
`);

const ExternalCompositionForm = ({
  project,
  organization,
  endpoint,
}: {
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
  endpoint?: string;
}) => {
  const notify = useNotifications();
  const [mutation, enable] = useMutation(ExternalCompositionForm_EnableMutation);
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        endpoint: endpoint ?? '',
        secret: '',
      },
      validationSchema: Yup.object().shape({
        endpoint: Yup.string().required(),
        secret: Yup.string().required(),
      }),
      onSubmit: values =>
        enable({
          input: {
            project: project.cleanId,
            organization: organization.cleanId,
            endpoint: values.endpoint,
            secret: values.secret,
          },
        }).then(result => {
          if (result.data?.enableExternalSchemaComposition?.ok) {
            notify('External composition enabled', 'success');
          }
        }),
    });

  const mutationError = mutation.data?.enableExternalSchemaComposition.error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <span>HTTP endpoint</span>
        <p className="pb-2 text-xs text-gray-300">A POST request will be sent to that endpoint</p>
        <Input
          placeholder="Endpoint"
          name="endpoint"
          value={values.endpoint}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          isInvalid={touched.endpoint && Boolean(errors.endpoint)}
          className="w-96"
        />
        {touched.endpoint && (errors.endpoint || mutationError?.inputErrors?.endpoint) && (
          <div className="mt-2 text-xs text-red-500">
            {errors.endpoint ?? mutationError?.inputErrors?.endpoint}
          </div>
        )}
      </div>

      <div>
        <span>Secret</span>
        <p className="pb-2 text-xs text-gray-300">
          The secret is needed to sign and verify the request.
        </p>
        <Input
          placeholder="Secret"
          name="secret"
          type="password"
          value={values.secret}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          isInvalid={touched.secret && Boolean(errors.secret)}
          className="w-96"
        />
        {touched.secret && (errors.secret || mutationError?.inputErrors?.secret) && (
          <div className="mt-2 text-xs text-red-500">
            {errors.secret ?? mutationError?.inputErrors?.secret}
          </div>
        )}
      </div>
      {mutation.error && <div className="mt-2 text-xs text-red-500">{mutation.error.message}</div>}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="large"
          className="px-10"
          disabled={isSubmitting}
        >
          Save
        </Button>
      </div>
    </form>
  );
};

export const ExternalComposition_DisableMutation = gql(`
  mutation ExternalComposition_DisableMutation($input: DisableExternalSchemaCompositionInput!) {
    disableExternalSchemaComposition(input: $input) {
      ok
      error
    }
  }
`);

export const ExternalComposition_ProjectConfigurationQuery = gql(`
  query ExternalComposition_ProjectConfigurationQuery($selector: ProjectSelectorInput!) {
    project(selector: $selector) {
      id
      cleanId
      externalSchemaComposition {
        endpoint
      }
    }
  }
`);

export const ExternalCompositionSettings = ({
  project,
  organization,
}: {
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}) => {
  const [enabled, setEnabled] = useState<boolean>();
  const [mutation, disableComposition] = useMutation(ExternalComposition_DisableMutation);
  const notify = useNotifications();
  const [projectQuery] = useQuery({
    query: ExternalComposition_ProjectConfigurationQuery,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
      },
    },
  });

  const handleSwitch = useCallback(
    async (status: boolean) => {
      if (status) {
        setEnabled(true);
      } else {
        setEnabled(false);
        const result = await disableComposition({
          input: {
            project: project.cleanId,
            organization: organization.cleanId,
          },
        });
        const error = result.error?.message || result.data?.disableExternalSchemaComposition.error;
        if (error) {
          notify(error, 'error');
          // fallback to the previous state
          setEnabled(true);
        }
      }
    },
    [disableComposition, setEnabled, notify],
  );

  const externalCompositionConfig = projectQuery.data?.project?.externalSchemaComposition;
  const initialEnabled = !!externalCompositionConfig;
  const isEnabled = typeof enabled === 'boolean' ? enabled : initialEnabled;
  const isLoading = projectQuery.fetching || mutation.fetching;
  const isFormVisible = isEnabled && !isLoading;

  return (
    <Card>
      <Heading className="mb-2 flex items-center justify-between gap-5">
        <span className="flex-shrink-0">External Composition</span>
        <div>
          {isLoading ? (
            <Spinner />
          ) : (
            <Switch
              className="shrink-0"
              checked={isEnabled}
              onCheckedChange={handleSwitch}
              disabled={mutation.fetching}
            />
          )}
        </div>
      </Heading>
      <p className="mb-3 font-light text-gray-300">
        Compose and validate schema outside GraphQL Hive
      </p>
      {isFormVisible ? (
        <ExternalCompositionForm
          project={project}
          organization={organization}
          endpoint={externalCompositionConfig?.endpoint}
        />
      ) : null}
    </Card>
  );
};
