import { useCallback, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import {
  Button,
  Card,
  DocsLink,
  DocsNote,
  Heading,
  Input,
  Spinner,
  Switch,
  Tooltip,
} from '@/components/v2';
import { ProductUpdatesLink } from '@/components/v2/docs-note';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useNotifications } from '@/lib/hooks';
import { CheckIcon, Cross2Icon, UpdateIcon } from '@radix-ui/react-icons';

export const ExternalCompositionStatus_TestQuery = graphql(`
  query ExternalCompositionStatus_TestQuery($selector: TestExternalSchemaCompositionInput!) {
    testExternalSchemaComposition(selector: $selector) {
      ok {
        id
        externalSchemaComposition {
          endpoint
        }
      }
      error {
        message
      }
    }
  }
`);

export const ExternalCompositionForm_EnableMutation = graphql(`
  mutation ExternalCompositionForm_EnableMutation($input: EnableExternalSchemaCompositionInput!) {
    enableExternalSchemaComposition(input: $input) {
      ok {
        id
        externalSchemaComposition {
          endpoint
        }
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

const ExternalCompositionForm_OrganizationFragment = graphql(`
  fragment ExternalCompositionForm_OrganizationFragment on Organization {
    cleanId
  }
`);

const ExternalCompositionForm_ProjectFragment = graphql(`
  fragment ExternalCompositionForm_ProjectFragment on Project {
    cleanId
  }
`);

const ExternalCompositionStatus = ({
  projectId,
  organizationId,
}: {
  projectId: string;
  organizationId: string;
}) => {
  const [query] = useQuery({
    query: ExternalCompositionStatus_TestQuery,
    variables: {
      selector: {
        project: projectId,
        organization: organizationId,
      },
    },
    requestPolicy: 'network-only',
  });

  const error = query.error?.message ?? query.data?.testExternalSchemaComposition?.error?.message;

  return (
    <Tooltip.Provider delayDuration={100}>
      {query.fetching ? (
        <Tooltip content="Connecting..." contentProps={{ side: 'right' }}>
          <UpdateIcon className="animate-spin h-5 w-5 text-gray-500" />
        </Tooltip>
      ) : null}
      {error ? (
        <Tooltip content={error} contentProps={{ side: 'right' }}>
          <Cross2Icon className="h-5 w-5 text-red-500" />
        </Tooltip>
      ) : null}
      {query.data?.testExternalSchemaComposition?.ok?.externalSchemaComposition?.endpoint ? (
        <Tooltip content="Service is available" contentProps={{ side: 'right' }}>
          <CheckIcon className="h-5 w-5 text-green-500" />
        </Tooltip>
      ) : null}
    </Tooltip.Provider>
  );
};

const ExternalCompositionForm = ({
  endpoint,
  ...props
}: {
  project: FragmentType<typeof ExternalCompositionForm_ProjectFragment>;
  organization: FragmentType<typeof ExternalCompositionForm_OrganizationFragment>;
  endpoint?: string;
}) => {
  const project = useFragment(ExternalCompositionForm_ProjectFragment, props.project);
  const organization = useFragment(
    ExternalCompositionForm_OrganizationFragment,
    props.organization,
  );
  const notify = useNotifications();
  const [mutation, enable] = useMutation(ExternalCompositionForm_EnableMutation);
  const {
    handleSubmit,
    values,
    handleChange,
    handleBlur,
    isSubmitting,
    errors,
    touched,
    dirty,
    resetForm,
  } = useFormik({
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
        resetForm();
        if (result.data?.enableExternalSchemaComposition?.ok) {
          notify('External composition enabled', 'success');
        }
      }),
  });

  const mutationError = mutation.data?.enableExternalSchemaComposition.error;

  return (
    <div className="flex justify-between">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <span>HTTP endpoint</span>
          <p className="pb-2 text-xs text-gray-300">A POST request will be sent to that endpoint</p>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Endpoint"
              name="endpoint"
              value={values.endpoint}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              isInvalid={touched.endpoint && !!errors.endpoint}
              className="w-96"
            />
            {!dirty &&
            (endpoint ||
              mutation.data?.enableExternalSchemaComposition.ok?.externalSchemaComposition
                ?.endpoint) ? (
              <ExternalCompositionStatus
                projectId={project.cleanId}
                organizationId={organization.cleanId}
              />
            ) : null}
          </div>
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
            isInvalid={touched.secret && !!errors.secret}
            className="w-96"
          />
          {touched.secret && (errors.secret || mutationError?.inputErrors?.secret) && (
            <div className="mt-2 text-xs text-red-500">
              {errors.secret ?? mutationError?.inputErrors?.secret}
            </div>
          )}
        </div>
        {mutation.error && (
          <div className="mt-2 text-xs text-red-500">{mutation.error.message}</div>
        )}
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
    </div>
  );
};

export const ExternalComposition_DisableMutation = graphql(`
  mutation ExternalComposition_DisableMutation($input: DisableExternalSchemaCompositionInput!) {
    disableExternalSchemaComposition(input: $input) {
      ok {
        id
        externalSchemaComposition {
          endpoint
        }
      }
      error
    }
  }
`);

export const ExternalComposition_ProjectConfigurationQuery = graphql(`
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

const ExternalCompositionSettings_OrganizationFragment = graphql(`
  fragment ExternalCompositionSettings_OrganizationFragment on Organization {
    cleanId
    ...ExternalCompositionForm_OrganizationFragment
  }
`);

const ExternalCompositionSettings_ProjectFragment = graphql(`
  fragment ExternalCompositionSettings_ProjectFragment on Project {
    cleanId
    isNativeFederationEnabled
    ...ExternalCompositionForm_ProjectFragment
  }
`);

export const ExternalCompositionSettings = (props: {
  project: FragmentType<typeof ExternalCompositionSettings_ProjectFragment>;
  organization: FragmentType<typeof ExternalCompositionSettings_OrganizationFragment>;
}) => {
  const project = useFragment(ExternalCompositionSettings_ProjectFragment, props.project);
  const organization = useFragment(
    ExternalCompositionSettings_OrganizationFragment,
    props.organization,
  );
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

  if (project.isNativeFederationEnabled) {
    return null;
  }

  const externalCompositionConfig = projectQuery.data?.project?.externalSchemaComposition;
  const initialEnabled = !!externalCompositionConfig;
  const isEnabled = typeof enabled === 'boolean' ? enabled : initialEnabled;
  const isLoading = projectQuery.fetching || mutation.fetching;
  const isFormVisible = isEnabled && !isLoading;

  return (
    <Card>
      <Heading className="mb-2 flex items-center justify-between gap-5">
        <span className="shrink-0">External Composition</span>
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

      <ProductUpdatesLink href="2023-10-10-native-federation-2">
        We're rolling out native Apollo Federation support in Hive!
      </ProductUpdatesLink>

      <DocsNote>
        External Schema Composition is required for using Apollo Federation 2 with Hive.
        <br />
        <DocsLink href="/management/external-schema-composition">
          Learn more about Apollo Federation 2 support
        </DocsLink>
      </DocsNote>

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
