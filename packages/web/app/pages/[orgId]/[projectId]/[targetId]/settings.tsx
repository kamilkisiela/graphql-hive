import { FC, useCallback, useEffect, useState } from 'react';
import { SchemaEditor } from '@theguild/editor';
import clsx from 'clsx';
import { useFormik } from 'formik';
import { gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import {
  Button,
  Card,
  Checkbox,
  Heading,
  Input,
  Switch,
  Table,
  Tag,
  TimeAgo,
  Title,
} from '@/components/v2';
import { AlertTriangleIcon } from '@/components/v2/icon';
import {
  CreateAccessTokenModal,
  DeleteTargetModal,
} from '@/components/v2/modals';
import {
  DeleteTokensDocument,
  OrganizationFieldsFragment,
  SetTargetValidationDocument,
  TargetFieldsFragment,
  TokensDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Spinner } from '@chakra-ui/react';

const columns = [
  { key: 'checkbox' },
  { key: 'alias' },
  { key: 'name' },
  { key: 'lastUsedAt', align: 'right' },
  { key: 'createdAt', align: 'right' },
] as const;

const Tokens: FC<{ organization: OrganizationFieldsFragment }> = ({
  organization,
}) => {
  const router = useRouteSelector();
  const [{ fetching: deleting }, mutate] = useMutation(DeleteTokensDocument);
  const [checked, setChecked] = useState<string[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  const [tokensQuery] = useQuery({
    query: TokensDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    },
  });

  const tokens = tokensQuery.data?.tokens.nodes;

  const deleteTokens = useCallback(async () => {
    await mutate({
      input: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        tokens: checked,
      },
    });
    setChecked([]);
  }, [
    checked,
    mutate,
    router.organizationId,
    router.projectId,
    router.targetId,
  ]);

  return (
    <Card>
      <Heading className="mb-2">Tokens</Heading>
      <p className="mb-3 font-light text-gray-300">
        Be careful! These tokens allow to read and write your target data.
      </p>
      <div className="my-3.5 flex justify-between">
        <Button
          variant="secondary"
          onClick={toggleModalOpen}
          size="large"
          className="px-5"
        >
          Generate new token
        </Button>
        <Button
          size="large"
          danger
          disabled={checked.length === 0 || deleting}
          className="px-9"
          onClick={deleteTokens}
        >
          Delete {checked.length || null}
        </Button>
      </div>
      <Table
        dataSource={tokens?.map((token) => ({
          id: token.id,
          alias: token.alias,
          name: token.name,
          checkbox: (
            <Checkbox
              onCheckedChange={(isChecked) =>
                setChecked(
                  isChecked
                    ? [...checked, token.id]
                    : checked.filter((k) => k !== token.id)
                )
              }
              checked={checked.includes(token.id)}
            />
          ),
          lastUsedAt: token.lastUsedAt ? (
            <>
              last used <TimeAgo date={token.lastUsedAt} />
            </>
          ) : (
            'not used yet'
          ),
          createdAt: (
            <>
              created <TimeAgo date={token.date} />
            </>
          ),
        }))}
        columns={columns}
      />
      {organization && isModalOpen && (
        <CreateAccessTokenModal
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
          organization={organization}
        />
      )}
    </Card>
  );
};

const Settings_UpdateBaseSchemaMutation = gql(/* GraphQL */ `
  mutation Settings_UpdateBaseSchema($input: UpdateBaseSchemaInput!) {
    updateBaseSchema(input: $input) {
      ok {
        updatedTarget {
          ...TargetFields
        }
      }
      error {
        message
      }
    }
  }
`);

const ExtendBaseSchema: FC<{ baseSchema: string }> = (props) => {
  const [mutation, mutate] = useMutation(Settings_UpdateBaseSchemaMutation);
  const router = useRouteSelector();
  const [baseSchema, setBaseSchema] = useState('');

  useEffect(() => {
    setBaseSchema(props.baseSchema);
  }, [props.baseSchema]);

  const isUnsaved = baseSchema?.trim() !== props.baseSchema?.trim();

  return (
    <Card>
      <Heading className="mb-2">Extend Your Schema</Heading>
      <p className="mb-3 font-light text-gray-300">
        Define a piece of SDL that will be added to every published schema.
        <br />
        Useful for AWS AppSync users to not send platform-specific part of
        schema to Hive.
      </p>
      <SchemaEditor
        theme="vs-dark"
        options={{ readOnly: mutation.fetching }}
        value={baseSchema}
        height={300}
        onChange={setBaseSchema}
      />
      {mutation.data?.updateBaseSchema.error && (
        <div className="text-red-500">
          {mutation.data.updateBaseSchema.error.message}
        </div>
      )}
      {mutation.error && (
        <div className="text-red-500">
          {mutation.error?.graphQLErrors[0]?.message ?? mutation.error.message}
        </div>
      )}
      <div className="mt-3 flex items-center gap-x-3">
        <Button
          size="large"
          variant="primary"
          className="px-5"
          disabled={mutation.fetching}
          onClick={() => {
            mutate({
              input: {
                organization: router.organizationId,
                project: router.projectId,
                target: router.targetId,
                newBase: baseSchema,
              },
            });
          }}
        >
          Save
        </Button>
        <Button
          size="large"
          variant="secondary"
          className="px-5"
          onClick={() => setBaseSchema(props.baseSchema)}
        >
          Reset
        </Button>
        {isUnsaved && <span className="text-green-500">Unsaved changes!</span>}
      </div>
    </Card>
  );
};

const Settings_TargetSettingsQuery = gql(/* GraphQL */ `
  query Settings_TargetSettingsQuery(
    $selector: TargetSelectorInput!
    $targetsSelector: ProjectSelectorInput!
    $organizationSelector: OrganizationSelectorInput!
  ) {
    targetSettings(selector: $selector) {
      ...TargetSettingsFields
    }
    targets(selector: $targetsSelector) {
      nodes {
        ...TargetEssentials
      }
    }
    organization(selector: $organizationSelector) {
      organization {
        id
        rateLimit {
          retentionInDays
        }
      }
    }
  }
`);

const Settings_UpdateTargetValidationSettingsMutation = gql(/* GraphQL */ `
  mutation Settings_UpdateTargetValidationSettings(
    $input: UpdateTargetValidationSettingsInput!
  ) {
    updateTargetValidationSettings(input: $input) {
      ok {
        updatedTargetValidationSettings {
          ...TargetValidationSettingsFields
        }
      }
      error {
        message
        inputErrors {
          percentage
          period
        }
      }
    }
  }
`);

const ConditionalBreakingChanges: FC = () => {
  const router = useRouteSelector();
  const [targetValidation, setValidation] = useMutation(
    SetTargetValidationDocument
  );
  const [mutation, updateValidation] = useMutation(
    Settings_UpdateTargetValidationSettingsMutation
  );
  const [targetSettings] = useQuery({
    query: Settings_TargetSettingsQuery,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
      targetsSelector: {
        organization: router.organizationId,
        project: router.projectId,
      },
      organizationSelector: {
        organization: router.organizationId,
      },
    },
  });

  const settings = targetSettings.data?.targetSettings.validation;
  const isEnabled = settings?.enabled || false;
  const possibleTargets = targetSettings.data?.targets.nodes;

  const {
    handleSubmit,
    isSubmitting,
    errors,
    touched,
    values,
    handleBlur,
    handleChange,
    setFieldValue,
    setFieldTouched,
  } = useFormik({
    enableReinitialize: true,
    initialValues: {
      percentage: settings?.percentage || 0,
      period: settings?.period || 0,
      targets: settings?.targets.map((t) => t.id) || [],
    },
    validationSchema: Yup.object().shape({
      percentage: Yup.number().min(0).max(100).required(),
      period: Yup.number()
        .min(1)
        .max(
          targetSettings.data?.organization?.organization?.rateLimit
            .retentionInDays ?? 30
        )
        .required(),
      targets: Yup.array().of(Yup.string()).min(1),
    }),
    onSubmit: (values) =>
      updateValidation({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: router.targetId,
          ...values,
        },
      }),
  });

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <Heading className="mb-2 flex items-center gap-5">
          Conditional Breaking Changes
          {targetSettings.fetching ? (
            <Spinner />
          ) : (
            <Switch
              className="shrink-0"
              checked={isEnabled}
              onCheckedChange={(enabled) => {
                setValidation({
                  input: {
                    target: router.targetId,
                    project: router.projectId,
                    organization: router.organizationId,
                    enabled,
                  },
                });
              }}
              disabled={targetValidation.fetching}
            />
          )}
        </Heading>
        <div
          className={clsx(
            'mb-3 flex flex-col items-start gap-3 font-light text-gray-500',
            !isEnabled && 'pointer-events-none opacity-25'
          )}
        >
          <div>
            A schema change is considered as breaking only if affects more than
            <Input
              name="percentage"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.percentage}
              isInvalid={touched.percentage && Boolean(errors.percentage)}
              disabled={isSubmitting}
              size="small"
              type="number"
              min="0"
              max="100"
              className="mx-2 !inline-flex !w-16"
            />
            % of traffic in past
            <Input
              name="period"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.period}
              isInvalid={touched.period && Boolean(errors.period)}
              disabled={isSubmitting}
              size="small"
              type="number"
              min="1"
              max="30"
              className="mx-2 !inline-flex !w-16"
            />
            days
          </div>
          {touched.percentage && errors.percentage && (
            <div className="text-red-500">{errors.percentage}</div>
          )}
          {mutation.data?.updateTargetValidationSettings.error?.inputErrors
            .percentage && (
            <div className="text-red-500">
              {
                mutation.data.updateTargetValidationSettings.error.inputErrors
                  .percentage
              }
            </div>
          )}
          {touched.period && errors.period && (
            <div className="text-red-500">{errors.period}</div>
          )}
          {mutation.data?.updateTargetValidationSettings.error?.inputErrors
            .period && (
            <div className="text-red-500">
              {
                mutation.data.updateTargetValidationSettings.error.inputErrors
                  .period
              }
            </div>
          )}
          Check collected usage data from these targets:
          {possibleTargets?.map((pt) => (
            <div key={pt.id} className="flex items-center gap-2 pl-5">
              <Checkbox
                checked={values.targets.includes(pt.id)}
                onCheckedChange={(isChecked) => {
                  setFieldValue(
                    'targets',
                    isChecked
                      ? [...values.targets, pt.id]
                      : values.targets.filter((value) => value !== pt.id)
                  );
                }}
                onBlur={() => setFieldTouched('targets', true)}
              />{' '}
              {pt.name}
            </div>
          ))}
          {touched.targets && errors.targets && (
            <div className="text-red-500">{errors.targets}</div>
          )}
          <Tag className="mt-5 flex-col !items-start gap-1">
            Example settings: Removal of a field is considered breaking if
            <div>
              <Tag color="yellow" className="py-0">
                0%
              </Tag>{' '}
              - the field was used at least once in past 30 days
            </div>
            <div>
              <Tag color="yellow" className="py-0">
                10%
              </Tag>{' '}
              - the field was requested by more than 10% of all GraphQL
              operations in recent 30 days
            </div>
          </Tag>
          <div>
            <Button
              type="submit"
              className="px-5"
              variant="primary"
              size="large"
              disabled={isSubmitting}
            >
              Save
            </Button>
            {mutation.error && (
              <span className="ml-2 text-red-500">
                {mutation.error.graphQLErrors[0]?.message ??
                  mutation.error.message}
              </span>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
};

const Settings_UpdateTargetNameMutation = gql(/* GraphQL */ `
  mutation Settings_UpdateTargetName($input: UpdateTargetNameInput!) {
    updateTargetName(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        updatedTarget {
          ...TargetFields
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

const SettingsPage: FC<{
  target: TargetFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ target, organization }) => {
  const router = useRouteSelector();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  const [mutation, mutate] = useMutation(Settings_UpdateTargetNameMutation);
  const {
    handleSubmit,
    values,
    handleChange,
    handleBlur,
    isSubmitting,
    errors,
    touched,
  } = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: target?.name || '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().required('Target name is required'),
    }),
    onSubmit: (values) =>
      mutate({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: router.targetId,
          name: values.name,
        },
      }),
  });

  return (
    <div className="flex flex-col gap-16">
      <Title title="Settings" />
      <Card>
        <Heading className="mb-2">Target Info</Heading>
        <p className="mb-3 font-light text-gray-300">
          Name of your target visible within organization.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-x-2">
          <Input
            placeholder="Target name"
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.name && Boolean(errors.name)}
            className="w-96"
          />
          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={isSubmitting}
            className="px-10"
          >
            Save
          </Button>
        </form>
        {touched.name && (errors.name || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.name ??
              mutation.error.graphQLErrors[0]?.message ??
              mutation.error.message}
          </div>
        )}
        {mutation.data?.updateTargetName.error?.inputErrors?.name && (
          <div className="mt-2 text-red-500">
            {mutation.data.updateTargetName.error.inputErrors.name}
          </div>
        )}
      </Card>

      <Tokens organization={organization} />

      <ConditionalBreakingChanges />

      {target && <ExtendBaseSchema baseSchema={target.baseSchema} />}

      <Card>
        <Heading className="mb-2">Delete Target</Heading>
        <p className="mb-3 font-light text-gray-300">
          Permanently remove your Target
        </p>
        <div className="flex items-center gap-x-2">
          <Button
            variant="primary"
            size="large"
            danger
            onClick={toggleModalOpen}
            className="px-5"
          >
            Delete Target
          </Button>
          <Tag color="yellow" className="py-2.5 px-4">
            <AlertTriangleIcon className="h-5 w-5" />
            This action is not reversible!
          </Tag>
        </div>
      </Card>
      <DeleteTargetModal
        isOpen={isModalOpen}
        toggleModalOpen={toggleModalOpen}
      />
    </div>
  );
};

export default SettingsPage;
