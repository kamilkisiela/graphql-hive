import React, { ReactElement, useCallback, useState } from 'react';
import clsx from 'clsx';
import { formatISO } from 'date-fns';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Page, TargetLayout } from '@/components/layouts/target';
import { SchemaEditor } from '@/components/schema-editor';
import { CDNAccessTokens } from '@/components/target/settings/cdn-access-tokens';
import { SchemaContracts } from '@/components/target/settings/schema-contracts';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DocsLink } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { CreateAccessTokenModal } from '@/components/ui/modal/create-access-token';
import { DeleteTargetModal } from '@/components/ui/modal/delete-target';
import {
  NavLayout,
  PageLayout,
  PageLayoutContent,
  SubPageLayout,
  SubPageLayoutHeader,
} from '@/components/ui/page-content-layout';
import { QueryError } from '@/components/ui/query-error';
import { TimeAgo } from '@/components/ui/time-ago';
import { useToast } from '@/components/ui/use-toast';
import { Combobox } from '@/components/v2/combobox';
import { Input } from '@/components/v2/input';
import { Spinner } from '@/components/v2/spinner';
import { Switch } from '@/components/v2/switch';
import { Table, TBody, Td, Tr } from '@/components/v2/table';
import { Tag } from '@/components/v2/tag';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { canAccessTarget, TargetAccessScope } from '@/lib/access/target';
import { subDays } from '@/lib/date-time';
import { useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@tanstack/react-router';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TargetSettings_TargetValidationSettingsFragment = graphql(`
  fragment TargetSettings_TargetValidationSettingsFragment on TargetValidationSettings {
    enabled
    period
    percentage
    targets {
      id
      cleanId
      name
    }
    excludedClients
  }
`);

const SetTargetValidationMutation = graphql(`
  mutation Settings_SetTargetValidation($input: SetTargetValidationInput!) {
    setTargetValidation(input: $input) {
      id
      validationSettings {
        ...TargetSettings_TargetValidationSettingsFragment
      }
    }
  }
`);

const RegistryAccessTokens_MeFragment = graphql(`
  fragment RegistryAccessTokens_MeFragment on Member {
    ...CanAccessTarget_MemberFragment
  }
`);

export const DeleteTokensDocument = graphql(`
  mutation deleteTokens($input: DeleteTokensInput!) {
    deleteTokens(input: $input) {
      selector {
        organization
        project
        target
      }
      deletedTokens
    }
  }
`);

export const TokensDocument = graphql(`
  query tokens($selector: TargetSelectorInput!) {
    tokens(selector: $selector) {
      total
      nodes {
        id
        alias
        name
        lastUsedAt
        date
      }
    }
  }
`);

function RegistryAccessTokens(props: {
  me: FragmentType<typeof RegistryAccessTokens_MeFragment>;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const me = useFragment(RegistryAccessTokens_MeFragment, props.me);
  const [{ fetching: deleting }, mutate] = useMutation(DeleteTokensDocument);
  const [checked, setChecked] = useState<string[]>([]);
  const [isModalOpen, toggleModalOpen] = useToggle();

  const [tokensQuery] = useQuery({
    query: TokensDocument,
    variables: {
      selector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
    },
  });

  const tokens = tokensQuery.data?.tokens.nodes;

  const deleteTokens = useCallback(async () => {
    await mutate({
      input: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
        tokens: checked,
      },
    });
    setChecked([]);
  }, [checked, mutate, props.organizationId, props.projectId, props.targetId]);

  const canManage = canAccessTarget(TargetAccessScope.TokensWrite, me);

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="Registry Access Tokens"
        description={
          <>
            <CardDescription>
              Registry Access Tokens are used to access to Hive Registry and perform actions on your
              targets/projects. In most cases, this token is used from the Hive CLI.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#registry-access-tokens"
                className="text-gray-500 hover:text-gray-300"
              >
                Learn more about Registry Access Tokens
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      {canManage && (
        <div className="my-3.5 flex justify-between">
          <Button onClick={toggleModalOpen}>Create new registry token</Button>
          {checked.length === 0 ? null : (
            <Button variant="destructive" disabled={deleting} onClick={deleteTokens}>
              Delete ({checked.length || null})
            </Button>
          )}
        </div>
      )}
      <Table>
        <TBody>
          {tokens?.map(token => (
            <Tr key={token.id}>
              <Td width="1">
                <Checkbox
                  onCheckedChange={isChecked =>
                    setChecked(
                      isChecked ? [...checked, token.id] : checked.filter(k => k !== token.id),
                    )
                  }
                  checked={checked.includes(token.id)}
                  disabled={!canManage}
                />
              </Td>
              <Td>{token.alias}</Td>
              <Td>{token.name}</Td>
              <Td align="right">
                {token.lastUsedAt ? (
                  <>
                    last used <TimeAgo date={token.lastUsedAt} />
                  </>
                ) : (
                  'not used yet'
                )}
              </Td>
              <Td align="right">
                created <TimeAgo date={token.date} />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {isModalOpen && (
        <CreateAccessTokenModal
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
        />
      )}
    </SubPageLayout>
  );
}

const Settings_UpdateBaseSchemaMutation = graphql(`
  mutation Settings_UpdateBaseSchema($input: UpdateBaseSchemaInput!) {
    updateBaseSchema(input: $input) {
      ok {
        updatedTarget {
          id
          baseSchema
        }
      }
      error {
        message
      }
    }
  }
`);

const ExtendBaseSchema = (props: {
  baseSchema: string;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const [mutation, mutate] = useMutation(Settings_UpdateBaseSchemaMutation);
  const [baseSchema, setBaseSchema] = useState(props.baseSchema);
  const { toast } = useToast();

  const isUnsaved = baseSchema?.trim() !== props.baseSchema?.trim();

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="Extend Your Schema"
        description={
          <>
            <CardDescription>
              Schema Extensions is pre-defined GraphQL schema that is automatically merged with your
              published schemas, before being checked and validated.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#schema-extensions"
                className="text-gray-500 hover:text-gray-300"
              >
                You can find more details and examples in the documentation
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      <SchemaEditor
        theme="vs-dark"
        options={{ readOnly: mutation.fetching }}
        value={baseSchema}
        height={300}
        onChange={value => setBaseSchema(value ?? '')}
      />
      {mutation.data?.updateBaseSchema.error && (
        <div className="text-red-500">{mutation.data.updateBaseSchema.error.message}</div>
      )}
      {mutation.error && (
        <div className="text-red-500">
          {mutation.error?.graphQLErrors[0]?.message ?? mutation.error.message}
        </div>
      )}
      <div className="flex items-center gap-x-3">
        <Button
          className="px-5"
          disabled={mutation.fetching}
          onClick={async () => {
            await mutate({
              input: {
                organization: props.organizationId,
                project: props.projectId,
                target: props.targetId,
                newBase: baseSchema,
              },
            }).then(result => {
              if (result.error || result.data?.updateBaseSchema.error) {
                toast({
                  variant: 'destructive',
                  title: 'Error',
                  description:
                    result.error?.message || result.data?.updateBaseSchema.error?.message,
                });
              } else {
                toast({
                  variant: 'default',
                  title: 'Success',
                  description: 'Base schema updated successfully',
                });
              }
            });
          }}
        >
          Save
        </Button>
        <Button
          variant="secondary"
          className="px-5"
          onClick={() => setBaseSchema(props.baseSchema)}
        >
          Reset
        </Button>
        {isUnsaved && <span className="text-sm text-green-500">Unsaved changes!</span>}
      </div>
    </SubPageLayout>
  );
};

const ClientExclusion_AvailableClientNamesQuery = graphql(`
  query ClientExclusion_AvailableClientNamesQuery($selector: ClientStatsByTargetsInput!) {
    clientStatsByTargets(selector: $selector) {
      nodes {
        name
      }
      total
    }
  }
`);

function ClientExclusion(
  props: React.PropsWithoutRef<
    {
      organizationId: string;
      projectId: string;
      selectedTargets: string[];
      clientsFromSettings: string[];
      value: string[];
    } & Pick<React.ComponentProps<typeof Combobox>, 'name' | 'disabled' | 'onBlur' | 'onChange'>
  >,
) {
  const now = floorDate(new Date());
  const [availableClientNamesQuery] = useQuery({
    query: ClientExclusion_AvailableClientNamesQuery,
    variables: {
      selector: {
        organization: props.organizationId,
        project: props.projectId,
        targetIds: props.selectedTargets,
        period: {
          from: formatISO(subDays(now, 90)),
          to: formatISO(now),
        },
      },
    },
  });

  const clientNamesFromStats =
    availableClientNamesQuery.data?.clientStatsByTargets.nodes.map(n => n.name) ?? [];
  const allClientNames = clientNamesFromStats.concat(
    props.clientsFromSettings.filter(clientName => !clientNamesFromStats.includes(clientName)),
  );

  return (
    <Combobox
      name={props.name}
      placeholder="Select..."
      value={props.value.map(name => ({ label: name, value: name }))}
      options={
        allClientNames.map(name => ({
          value: name,
          label: name,
        })) ?? []
      }
      onBlur={props.onBlur}
      onChange={props.onChange}
      disabled={props.disabled}
      loading={availableClientNamesQuery.fetching}
    />
  );
}

const TargetSettingsPage_TargetSettingsQuery = graphql(`
  query TargetSettingsPage_TargetSettingsQuery(
    $selector: TargetSelectorInput!
    $targetsSelector: ProjectSelectorInput!
    $organizationSelector: OrganizationSelectorInput!
  ) {
    target(selector: $selector) {
      id
      validationSettings {
        enabled
        percentage
        period
        targets {
          id
        }
        excludedClients
      }
    }
    targets(selector: $targetsSelector) {
      nodes {
        id
        name
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

const TargetSettingsPage_UpdateTargetValidationSettingsMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetValidationSettings(
    $input: UpdateTargetValidationSettingsInput!
  ) {
    updateTargetValidationSettings(input: $input) {
      ok {
        target {
          id
          validationSettings {
            ...TargetSettings_TargetValidationSettingsFragment
          }
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

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

const ConditionalBreakingChanges = (props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const [targetValidation, setValidation] = useMutation(SetTargetValidationMutation);
  const [mutation, updateValidation] = useMutation(
    TargetSettingsPage_UpdateTargetValidationSettingsMutation,
  );
  const [targetSettings] = useQuery({
    query: TargetSettingsPage_TargetSettingsQuery,
    variables: {
      selector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
      targetsSelector: {
        organization: props.organizationId,
        project: props.projectId,
      },
      organizationSelector: {
        organization: props.organizationId,
      },
    },
  });

  const settings = targetSettings.data?.target?.validationSettings;
  const isEnabled = settings?.enabled || false;
  const possibleTargets = targetSettings.data?.targets.nodes;
  const { toast } = useToast();

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
      targets: settings?.targets.map(t => t.id) || [],
      excludedClients: settings?.excludedClients ?? [],
    },
    validationSchema: Yup.object().shape({
      percentage: Yup.number().min(0).max(100).required(),
      period: Yup.number()
        .min(1)
        .max(targetSettings.data?.organization?.organization?.rateLimit.retentionInDays ?? 30)
        .required(),
      targets: Yup.array().of(Yup.string()).min(1),
      excludedClients: Yup.array().of(Yup.string()),
    }),
    onSubmit: values =>
      updateValidation({
        input: {
          organization: props.organizationId,
          project: props.projectId,
          target: props.targetId,
          ...values,
        },
      }).then(result => {
        if (result.error || result.data?.updateTargetValidationSettings.error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description:
              result.error?.message || result.data?.updateTargetValidationSettings.error?.message,
          });
        } else {
          toast({
            variant: 'default',
            title: 'Success',
            description: 'Conditional breaking changes settings updated successfully',
          });
        }
      }),
  });

  return (
    <form onSubmit={handleSubmit}>
      <SubPageLayout>
        <SubPageLayoutHeader
          title="Conditional Breaking Changes"
          description={
            <>
              <CardDescription>
                Conditional Breaking Changes can change the behavior of schema checks, based on real
                traffic data sent to Hive.
              </CardDescription>
              <CardDescription>
                <DocsLink
                  href="/management/targets#conditional-breaking-changes"
                  className="text-gray-500 hover:text-gray-300"
                >
                  Learn more
                </DocsLink>
              </CardDescription>
            </>
          }
        >
          {targetSettings.fetching ? (
            <Spinner />
          ) : (
            <Switch
              className="shrink-0"
              checked={isEnabled}
              onCheckedChange={async enabled => {
                await setValidation({
                  input: {
                    target: props.targetId, // targetId is the target we are updating
                    project: props.projectId,
                    organization: props.organizationId,
                    enabled,
                  },
                });
              }}
              disabled={targetValidation.fetching}
            />
          )}
        </SubPageLayoutHeader>
        <div className={clsx('text-gray-300', !isEnabled && 'pointer-events-none opacity-25')}>
          <div>
            A schema change is considered as breaking only if it affects more than
            <Input
              name="percentage"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.percentage}
              isInvalid={touched.percentage && !!errors.percentage}
              disabled={isSubmitting}
              size="small"
              type="number"
              min="0"
              max="100"
              className="mx-2 !inline-flex !w-16"
            />
            % of traffic in the past
            <Input
              name="period"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.period}
              isInvalid={touched.period && !!errors.period}
              disabled={isSubmitting}
              size="small"
              type="number"
              min="1"
              max={targetSettings.data?.organization?.organization?.rateLimit.retentionInDays ?? 30}
              className="mx-2 !inline-flex !w-16"
            />
            days.
          </div>
          <div className="mt-3">
            {touched.percentage && errors.percentage && (
              <div className="text-red-500">{errors.percentage}</div>
            )}
            {mutation.data?.updateTargetValidationSettings.error?.inputErrors.percentage && (
              <div className="text-red-500">
                {mutation.data.updateTargetValidationSettings.error.inputErrors.percentage}
              </div>
            )}
            {touched.period && errors.period && <div className="text-red-500">{errors.period}</div>}
            {mutation.data?.updateTargetValidationSettings.error?.inputErrors.period && (
              <div className="text-red-500">
                {mutation.data.updateTargetValidationSettings.error.inputErrors.period}
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <div className="space-y-2">
                <div>
                  <div className="font-semibold">Allow breaking change for these clients:</div>
                  <div className="text-xs text-gray-400">
                    Marks a breaking change as safe when it only affects the following clients.
                  </div>
                </div>
                <div className="max-w-[420px]">
                  {values.targets.length > 0 ? (
                    <ClientExclusion
                      organizationId={props.organizationId}
                      projectId={props.projectId}
                      selectedTargets={values.targets}
                      clientsFromSettings={settings?.excludedClients ?? []}
                      name="excludedClients"
                      value={values.excludedClients}
                      onBlur={() => setFieldTouched('excludedClients')}
                      onChange={async options => {
                        await setFieldValue(
                          'excludedClients',
                          options.map(o => o.value),
                        );
                      }}
                      disabled={isSubmitting}
                    />
                  ) : (
                    <div className="text-gray-500">Select targets first</div>
                  )}
                </div>
                {touched.excludedClients && errors.excludedClients && (
                  <div className="text-red-500">{errors.excludedClients}</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <div className="font-semibold">Schema usage data from these targets:</div>
                <div className="text-xs text-gray-400">
                  Marks a breaking change as safe when it was not requested in the targets clients.
                </div>
              </div>
              <div className="pl-2">
                {possibleTargets?.map(pt => (
                  <div key={pt.id} className="flex items-center gap-x-2">
                    <Checkbox
                      checked={values.targets.includes(pt.id)}
                      onCheckedChange={async isChecked => {
                        await setFieldValue(
                          'targets',
                          isChecked
                            ? [...values.targets, pt.id]
                            : values.targets.filter(value => value !== pt.id),
                        );
                      }}
                      onBlur={() => setFieldTouched('targets', true)}
                    />{' '}
                    {pt.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {touched.targets && errors.targets && (
            <div className="text-red-500">{errors.targets}</div>
          )}
          <div className="mb-3 mt-5 space-y-2 rounded border-l-2 border-l-gray-800 bg-gray-600/10 py-2 pl-5 text-gray-400">
            <div>
              <div className="font-semibold">Example settings</div>
              <div className="text-sm">Removal of a field is considered breaking if</div>
            </div>

            <div className="text-sm">
              <Tag color="yellow" className="py-0">
                0%
              </Tag>{' '}
              - the field was used at least once in past 30 days
            </div>
            <div className="text-sm">
              <Tag color="yellow" className="py-0">
                10%
              </Tag>{' '}
              - the field was requested by more than 10% of all GraphQL operations in recent 30 days
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            Save
          </Button>
          {mutation.error && (
            <span className="ml-2 text-red-500">
              {mutation.error.graphQLErrors[0]?.message ?? mutation.error.message}
            </span>
          )}
        </div>
      </SubPageLayout>
    </form>
  );
};

function TargetName(props: {
  targetName: string | null;
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [mutation, mutate] = useMutation(TargetSettingsPage_UpdateTargetNameMutation);
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        name: props.targetName || '',
      },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Target name is required'),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: props.organizationId,
            project: props.projectId,
            target: props.targetId,
            name: values.name,
          },
        }).then(result => {
          if (result?.data?.updateTargetName?.ok) {
            toast({
              variant: 'default',
              title: 'Success',
              description: 'Target name updated successfully',
            });

            const newTargetId = result.data.updateTargetName.ok.updatedTarget.cleanId;
            void router.navigate({
              to: '/$organizationId/$projectId/$targetId/settings',
              params: {
                organizationId: props.organizationId,
                projectId: props.projectId,
                targetId: newTargetId,
              },
              search: {
                page: subPages[0].key,
              },
            });
          } else if (result.error || result.data?.updateTargetName.error?.message) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: result.error?.message || result.data?.updateTargetName.error?.message,
            });
          }
        }),
    });

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="Target Name"
        description={
          <>
            <CardDescription>
              Changing the name of your target will also change the slug of your target URL, and
              will invalidate any existing links to your target.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#rename-a-target"
                className="text-gray-500 hover:text-gray-300"
              >
                You can read more about it in the documentation
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      <form onSubmit={handleSubmit}>
        <div className="flex flex-row items-center gap-x-2">
          <Input
            placeholder="Target name"
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.name && !!errors.name}
            className="w-96"
          />
          <Button type="submit" disabled={isSubmitting}>
            Save
          </Button>
        </div>

        {touched.name && (errors.name || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.name ?? mutation.error?.graphQLErrors[0]?.message ?? mutation.error?.message}
          </div>
        )}
        {mutation.data?.updateTargetName.error?.inputErrors?.name && (
          <div className="mt-2 text-red-500">
            {mutation.data.updateTargetName.error.inputErrors.name}
          </div>
        )}
      </form>
    </SubPageLayout>
  );
}

const TargetSettingsPage_UpdateTargetGraphQLEndpointUrl = graphql(`
  mutation TargetSettingsPage_UpdateTargetGraphQLEndpointUrl(
    $input: UpdateTargetGraphQLEndpointUrlInput!
  ) {
    updateTargetGraphQLEndpointUrl(input: $input) {
      ok {
        target {
          id
          graphqlEndpointUrl
        }
      }
      error {
        message
      }
    }
  }
`);

function GraphQLEndpointUrl(props: {
  graphqlEndpointUrl: string | null;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const { toast } = useToast();
  const [mutation, mutate] = useMutation(TargetSettingsPage_UpdateTargetGraphQLEndpointUrl);
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        graphqlEndpointUrl: props.graphqlEndpointUrl || '',
      },
      validationSchema: Yup.object().shape({
        graphqlEndpointUrl: Yup.string()
          .url('Please enter a valid url.')
          .min(1, 'Please enter a valid url.')
          .max(300, 'Max 300 chars.'),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: props.organizationId,
            project: props.projectId,
            target: props.targetId,
            graphqlEndpointUrl: values.graphqlEndpointUrl === '' ? null : values.graphqlEndpointUrl,
          },
        }).then(result => {
          if (result.data?.updateTargetGraphQLEndpointUrl.error?.message || result.error) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description:
                result.data?.updateTargetGraphQLEndpointUrl.error?.message || result.error?.message,
            });
          } else {
            toast({
              variant: 'default',
              title: 'Success',
              description: 'GraphQL endpoint url updated successfully',
            });
          }
        }),
    });

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="GraphQL Endpoint URL"
        description={
          <>
            <CardDescription>
              The endpoint url will be used for querying the target from the{' '}
              <Link
                to="/$organizationId/$projectId/$targetId/laboratory"
                params={{
                  organizationId: props.organizationId,
                  projectId: props.projectId,
                  targetId: props.targetId,
                }}
              >
                Hive Laboratory
              </Link>
              .
            </CardDescription>
          </>
        }
      />
      <form onSubmit={handleSubmit}>
        <div className="flex flex-row items-center gap-x-2">
          <Input
            placeholder="Endpoint Url"
            name="graphqlEndpointUrl"
            value={values.graphqlEndpointUrl}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.graphqlEndpointUrl && !!errors.graphqlEndpointUrl}
            className="w-96"
          />
          <Button type="submit" disabled={isSubmitting}>
            Save
          </Button>
        </div>
        {touched.graphqlEndpointUrl && (errors.graphqlEndpointUrl || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.graphqlEndpointUrl ??
              mutation.error?.graphQLErrors[0]?.message ??
              mutation.error?.message}
          </div>
        )}
        {mutation.data?.updateTargetGraphQLEndpointUrl.error && (
          <div className="mt-2 text-red-500">
            {mutation.data.updateTargetGraphQLEndpointUrl.error.message}
          </div>
        )}
      </form>
    </SubPageLayout>
  );
}

const TargetSettingsPage_UpdateTargetNameMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetName($input: UpdateTargetNameInput!) {
    updateTargetName(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        updatedTarget {
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

const TargetSettingsPage_TargetFragment = graphql(`
  fragment TargetSettingsPage_TargetFragment on Target {
    id
    name
    baseSchema
  }
`);

const TargetSettingsPage_OrganizationFragment = graphql(`
  fragment TargetSettingsPage_OrganizationFragment on Organization {
    me {
      ...CanAccessTarget_MemberFragment
      ...RegistryAccessTokens_MeFragment
      ...CDNAccessTokens_MeFragment
    }
  }
`);

function TargetDelete(props: { organizationId: string; projectId: string; targetId: string }) {
  const [isModalOpen, toggleModalOpen] = useToggle();

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="Delete Target"
        description={
          <>
            <CardDescription>
              Deleting an project also delete all schemas and data associated with it.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#delete-a-target"
                className="text-gray-500 hover:text-gray-300"
              >
                <strong>This action is not reversible!</strong> You can find more information about
                this process in the documentation
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      <Button variant="destructive" onClick={toggleModalOpen}>
        Delete Target
      </Button>

      <DeleteTargetModal
        organizationId={props.organizationId}
        projectId={props.projectId}
        targetId={props.targetId}
        isOpen={isModalOpen}
        toggleModalOpen={toggleModalOpen}
      />
    </SubPageLayout>
  );
}

const TargetSettingsPageQuery = graphql(`
  query TargetSettingsPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        id
        cleanId
        ...TargetSettingsPage_OrganizationFragment
        me {
          ...CDNAccessTokens_MeFragment
        }
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      id
      cleanId
      type
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
      name
      graphqlEndpointUrl
      ...TargetSettingsPage_TargetFragment
    }
  }
`);

const subPages = [
  {
    key: 'general',
    title: 'General',
  },
  {
    key: 'cdn',
    title: 'CDN Tokens',
  },
  {
    key: 'registry-token',
    title: 'Registry Tokens',
  },
  {
    key: 'breaking-changes',
    title: 'Breaking Changes',
  },
  {
    key: 'base-schema',
    title: 'Base Schema',
  },
  {
    key: 'schema-contracts',
    title: 'Schema Contracts',
  },
] as const;

type SubPage = (typeof subPages)[number]['key'];

function TargetSettingsContent(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  page?: SubPage;
}) {
  const router = useRouter();
  const [query] = useQuery({
    query: TargetSettingsPageQuery,
    variables: {
      organizationId: props.organizationId,
      projectId: props.projectId,
      targetId: props.targetId,
    },
  });

  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationForSettings = useFragment(
    TargetSettingsPage_OrganizationFragment,
    currentOrganization,
  );

  const targetForSettings = useFragment(TargetSettingsPage_TargetFragment, currentTarget);

  const canAccessTokens = canAccessTarget(
    TargetAccessScope.TokensRead,
    organizationForSettings?.me ?? null,
  );
  const canDelete = canAccessTarget(TargetAccessScope.Delete, organizationForSettings?.me ?? null);

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  return (
    <TargetLayout
      targetId={props.targetId}
      projectId={props.projectId}
      organizationId={props.organizationId}
      page={Page.Settings}
    >
      {currentOrganization && currentProject && currentTarget && organizationForSettings ? (
        <PageLayout>
          <NavLayout>
            {subPages.map(subPage => {
              if (
                subPage.key === 'schema-contracts' &&
                currentProject.type !== ProjectType.Federation
              ) {
                return null;
              }
              return (
                <Button
                  key={subPage.key}
                  variant="ghost"
                  onClick={() => {
                    void router.navigate({
                      search: {
                        page: subPage.key,
                      },
                    });
                  }}
                  className={cn(
                    props.page === subPage.key
                      ? 'bg-muted hover:bg-muted'
                      : 'hover:bg-transparent hover:underline',
                    'w-full justify-start text-left',
                  )}
                >
                  {subPage.title}
                </Button>
              );
            })}
          </NavLayout>
          <PageLayoutContent>
            {currentOrganization && currentProject && currentTarget && organizationForSettings ? (
              <div className="space-y-12">
                {props.page === 'general' ? (
                  <>
                    <TargetName
                      targetName={currentTarget.name}
                      targetId={currentTarget.cleanId}
                      projectId={currentProject.cleanId}
                      organizationId={currentOrganization.cleanId}
                    />
                    <GraphQLEndpointUrl
                      targetId={currentTarget.cleanId}
                      projectId={currentProject.cleanId}
                      organizationId={currentOrganization.cleanId}
                      graphqlEndpointUrl={currentTarget.graphqlEndpointUrl ?? null}
                    />
                    {canDelete && (
                      <TargetDelete
                        targetId={currentTarget.cleanId}
                        projectId={currentProject.cleanId}
                        organizationId={currentOrganization.cleanId}
                      />
                    )}
                  </>
                ) : null}
                {props.page === 'cdn' && canAccessTokens ? (
                  <CDNAccessTokens
                    me={organizationForSettings.me}
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                  />
                ) : null}
                {props.page === 'registry-token' && canAccessTokens ? (
                  <RegistryAccessTokens
                    me={organizationForSettings.me}
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                  />
                ) : null}
                {props.page === 'breaking-changes' ? (
                  <ConditionalBreakingChanges
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                  />
                ) : null}
                {props.page === 'base-schema' ? (
                  <ExtendBaseSchema
                    baseSchema={targetForSettings?.baseSchema ?? ''}
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                    targetId={props.targetId}
                  />
                ) : null}
                {props.page === 'schema-contracts' ? (
                  <SchemaContracts organizationId="" projectId="" targetId="" />
                ) : null}
              </div>
            ) : null}
          </PageLayoutContent>
        </PageLayout>
      ) : null}
    </TargetLayout>
  );
}

export function TargetSettingsPage(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  page?: SubPage;
}) {
  return (
    <>
      <Meta title="Settings" />
      <TargetSettingsContent
        organizationId={props.organizationId}
        projectId={props.projectId}
        targetId={props.targetId}
        page={props.page}
      />
    </>
  );
}
