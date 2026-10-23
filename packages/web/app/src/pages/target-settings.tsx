import {
  ComponentProps,
  PropsWithoutRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { SlugForm, slugFormSchema, type SlugFormValues } from '@/components/common/slug-form';
import { LayoutContent } from '@/components/layouts/layout-content';
import { SchemaEditor } from '@/components/schema-editor';
import {
  AppDeploymentProtectionForm,
  AppDeploymentProtectionFormSchema,
  type AppDeploymentProtectionFormValues,
} from '@/components/target/settings/app-deployment-protection-form';
import {
  BreakingChangesForm,
  breakingChangesFormSchema,
  type BreakingChangesFormValues,
} from '@/components/target/settings/breaking-changes-form';
import {
  DangerousChangesForm,
  DangerousChangesFormSchema,
  JustSavedLabel,
  SavedLabel,
  UnsavedChangesLabel,
  type DangerousChangesFormValues,
} from '@/components/target/settings/dangerous-changes-form';
import {
  GraphqlEndpointForm,
  GraphqlEndpointFormSchema,
  type GraphqlEndpointFormValues,
} from '@/components/target/settings/graphql-endpoint-form';
import { CreateAccessTokenModal } from '@/components/target/settings/registry-access-token';
import { Combobox } from '@/components/ui/combobox';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { Meta } from '@/components/ui/meta';
import { Navigation } from '@/components/ui/navigation/navigation';
import {
  PageLayout,
  PageLayoutContent,
  SubPageLayout,
  SubPageLayoutHeader,
} from '@/components/ui/page-content-layout';
import { Button } from '@/components/ui/primitives/button/button';
import { AlertDialog } from '@/components/ui/primitives/overlays/alert-dialog/alert-dialog';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { Switch } from '@/components/ui/primitives/switch/switch';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { QueryError } from '@/components/ui/query-error';
import { ResourceDetails } from '@/components/ui/resource-details';
import { env } from '@/env/frontend';
import { graphql, useFragment } from '@/gql';
import {
  AppDeploymentProtectionRuleLogicType,
  BreakingChangeFormulaType,
  DangerousChangeType,
  ProjectType,
} from '@/gql/graphql';
import { subDays } from '@/lib/date-time';
import { useSlugs, useToggle } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Outlet, useRouter } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

/**
 * We previously used a different character for token masking.
 * This function standardizes it by replacing all non-alphanumeric characters
 * with bullet points (•) to ensure consistent formatting.
 * @param tokenAlias 553••***•••&*******••••••••••••7ab
 * @returns 553••••••••••••••••••7ab
 */
function normalizeTokenAlias(tokenAlias: string): string {
  return tokenAlias.replaceAll(/[^a-z0-9]/g, '•');
}

export const DeleteTokensDocument = graphql(`
  mutation deleteTokens($input: DeleteTokensInput!) {
    deleteTokens(input: $input) {
      selector {
        organizationSlug
        projectSlug
        targetSlug
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

function RegistryAccessTokens() {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [{ fetching: deleting }, mutate] = useMutation(DeleteTokensDocument);
  const [checked, setChecked] = useState<string[]>([]);
  const [isModalOpen, toggleModalOpen] = useToggle();

  const [tokensQuery] = useQuery({
    query: TokensDocument,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
    },
  });

  const tokens = tokensQuery.data?.tokens.nodes;

  const deleteTokens = useCallback(async () => {
    await mutate({
      input: {
        organizationSlug,
        projectSlug,
        targetSlug,
        tokenIds: checked,
      },
    });
    setChecked([]);
  }, [checked, mutate, organizationSlug, projectSlug, targetSlug]);

  type Token = NonNullable<typeof tokens>[number];
  const columns: ColumnDef<Token, unknown>[] = [
    {
      id: 'select',
      meta: { width: 'xs' },
      cell: ({ row }) => (
        <DataTableCell
          kind="checkbox"
          checked={checked.includes(row.original.id)}
          onCheckedChange={isChecked =>
            setChecked(
              isChecked
                ? [...checked, row.original.id]
                : checked.filter(k => k !== row.original.id),
            )
          }
          label={`Select ${row.original.name}`}
        />
      ),
    },
    {
      id: 'alias',
      header: 'Key',
      cell: ({ row }) => (
        <DataTableCell kind="text" value={normalizeTokenAlias(row.original.alias)} mono />
      ),
    },
    {
      id: 'name',
      header: 'Name',
      meta: { width: 'fill' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.name} weight="medium" />,
    },
    {
      id: 'lastUsedAt',
      header: 'Last Used',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.lastUsedAt ? (
          <DataTableCell kind="time" date={row.original.lastUsedAt} />
        ) : (
          <DataTableCell kind="text" value="not used yet" tone="muted" />
        ),
    },
    {
      id: 'date',
      header: 'Created At',
      meta: { align: 'right' },
      cell: ({ row }) => <DataTableCell kind="time" date={row.original.date} />,
    },
  ];

  return (
    <SubPageLayout data-cy="target-settings-registry-token">
      <SubPageLayoutHeader
        subPageTitle="Registry Access Tokens"
        description="Registry Access Tokens are used to access to Hive Registry and perform actions on your targets/projects. In most cases, this token is used from the Hive CLI."
        docsLink={{
          href: '/schema-registry/management/targets#registry-access-tokens',
          text: 'Learn more about Registry Access Tokens',
        }}
        sideContent={
          <Button data-cy="new-button" onClick={toggleModalOpen}>
            Create new registry token
          </Button>
        }
      />
      <div className="my-3.5 flex justify-end">
        {checked.length === 0 ? null : (
          <Button
            data-cy="delete-button"
            variant="destructive"
            disabled={deleting}
            onClick={deleteTokens}
          >
            Delete ({checked.length || null})
          </Button>
        )}
      </div>
      <DataTable
        data={tokens ?? []}
        columns={columns}
        getRowId={token => token.id}
        pagination={{ kind: 'none' }}
        loading={tokensQuery.fetching && !tokensQuery.data}
        emptyMessage="No registry tokens yet."
      />
      <CreateAccessTokenModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
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

const ExtendBaseSchema = (props: { baseSchema: string }) => {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [mutation, mutate] = useMutation(Settings_UpdateBaseSchemaMutation);
  const [baseSchema, setBaseSchema] = useState(props.baseSchema);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const { toast } = useToast();

  const isUnsaved = baseSchema?.trim() !== props.baseSchema?.trim();

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        subPageTitle="Extend Your Schema"
        description="Schema Extensions is pre-defined GraphQL schema that is automatically merged with your published schemas, before being checked and validated."
        docsLink={{
          href: '/schema-registry/management/targets#schema-extensions',
          text: 'You can find more details and examples in the documentation',
        }}
      />
      <SchemaEditor
        options={{ readOnly: mutation.fetching }}
        value={baseSchema}
        height={300}
        onChange={value => setBaseSchema(value ?? '')}
        onSyntaxErrors={markers => setSyntaxError(markers[0]?.message ?? null)}
      />
      {syntaxError && <div className="text-critical">{syntaxError}</div>}
      {mutation.data?.updateBaseSchema.error && (
        <div className="text-critical">{mutation.data.updateBaseSchema.error.message}</div>
      )}
      {mutation.error && (
        <div className="text-critical">
          {mutation.error?.graphQLErrors[0]?.message ?? mutation.error.message}
        </div>
      )}
      <div className="flex items-center gap-x-3">
        <Button
          disabled={mutation.fetching}
          onClick={async () => {
            await mutate({
              input: {
                organizationSlug,
                projectSlug,
                targetSlug,
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
        <Button variant="outline" onClick={() => setBaseSchema(props.baseSchema)}>
          Reset
        </Button>
        {isUnsaved && <span className="text-sm text-success">Unsaved changes!</span>}
      </div>
    </SubPageLayout>
  );
};

const ClientExclusion_AvailableClientNamesQuery = graphql(`
  query ClientExclusion_AvailableClientNamesQuery($selector: ClientStatsByTargetsInput!) {
    clientStatsByTargets(selector: $selector) {
      edges {
        node {
          name
        }
      }
    }
  }
`);

function ClientExclusion(
  props: PropsWithoutRef<
    {
      selectedTargetIds: string[];
      clientsFromSettings: string[];
      retentionInDays: number;
      value: string[];
    } & Pick<ComponentProps<typeof Combobox>, 'name' | 'disabled' | 'onBlur' | 'onChange'>
  >,
) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  const now = floorDate(new Date());
  const [availableClientNamesQuery] = useQuery({
    query: ClientExclusion_AvailableClientNamesQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetIds: props.selectedTargetIds,
        // Clients seen in the last 90 days, or as far back as the plan keeps.
        period: {
          from: formatISO(subDays(now, Math.min(90, props.retentionInDays))),
          to: formatISO(now),
        },
      },
    },
  });

  const clientNamesFromStats =
    availableClientNamesQuery.data?.clientStatsByTargets.edges.map(e => e.node.name) ?? [];
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

const AppDeploymentExclusion_AvailableAppDeploymentNamesQuery = graphql(`
  query AppDeploymentExclusion_AvailableAppDeploymentNamesQuery($selector: TargetSelectorInput!) {
    target(reference: { bySelector: $selector }) {
      id
      appDeployments(first: 100) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`);

function AppDeploymentExclusion(
  props: PropsWithoutRef<
    {
      appDeploymentsFromSettings: string[];
      value: string[];
    } & Pick<ComponentProps<typeof Combobox>, 'name' | 'disabled' | 'onBlur' | 'onChange'>
  >,
) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [availableAppDeploymentNamesQuery] = useQuery({
    query: AppDeploymentExclusion_AvailableAppDeploymentNamesQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
    },
  });

  if (availableAppDeploymentNamesQuery.error) {
    return (
      <div className="text-sm text-critical">Failed to load app deployments. Please try again.</div>
    );
  }

  const appDeploymentNamesFromQuery = [
    ...new Set(
      availableAppDeploymentNamesQuery.data?.target?.appDeployments?.edges.map(e => e.node.name) ??
        [],
    ),
  ];
  const allAppDeploymentNames = appDeploymentNamesFromQuery.concat(
    props.appDeploymentsFromSettings.filter(name => !appDeploymentNamesFromQuery.includes(name)),
  );

  return (
    <Combobox
      name={props.name}
      placeholder="Select..."
      value={props.value.map(name => ({ label: name, value: name }))}
      options={
        allAppDeploymentNames.map(name => ({
          value: name,
          label: name,
        })) ?? []
      }
      onBlur={props.onBlur}
      onChange={props.onChange}
      disabled={props.disabled}
      loading={availableAppDeploymentNamesQuery.fetching}
    />
  );
}

const TargetSettings_ConditionalBreakingChangeConfigurationFragment = graphql(`
  fragment TargetSettings_ConditionalBreakingChangeConfigurationFragment on ConditionalBreakingChangeConfiguration {
    isEnabled
    period
    percentage
    requestCount
    breakingChangeFormula
    targets {
      id
      slug
    }
    excludedClients
    excludedAppDeployments
  }
`);

const TargetSettings_AppDeploymentProtectionConfigurationFragment = graphql(`
  fragment TargetSettings_AppDeploymentProtectionConfigurationFragment on AppDeploymentProtectionConfiguration {
    isEnabled
    minDaysInactive
    minDaysSinceCreation
    maxTrafficPercentage
    trafficPeriodDays
    ruleLogic
  }
`);

export const TargetSettingsPage_TargetSettingsQuery = graphql(`
  query TargetSettingsPage_TargetSettingsQuery(
    $selector: TargetSelectorInput!
    $targetsSelector: ProjectSelectorInput!
    $organizationSelector: OrganizationSelectorInput!
  ) {
    target(reference: { bySelector: $selector }) {
      id
      failDiffOnDangerousChange
      failAllDangerousChanges
      failDangerousChangeTypes
      conditionalBreakingChangeConfiguration {
        ...TargetSettings_ConditionalBreakingChangeConfigurationFragment
      }
      appDeploymentProtectionConfiguration {
        ...TargetSettings_AppDeploymentProtectionConfigurationFragment
      }
    }
    targets(selector: $targetsSelector) {
      edges {
        node {
          id
          slug
        }
      }
    }
    organization(reference: { bySelector: $organizationSelector }) {
      id
      usageRetentionInDays
    }
  }
`);

const TargetSettingsPage_UpdateTargetConditionalBreakingChangeConfigurationMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetConditionalBreakingChangeConfigurationMutation(
    $input: UpdateTargetConditionalBreakingChangeConfigurationInput!
  ) {
    updateTargetConditionalBreakingChangeConfiguration(input: $input) {
      ok {
        target {
          id
          failDiffOnDangerousChange
          conditionalBreakingChangeConfiguration {
            ...TargetSettings_ConditionalBreakingChangeConfigurationFragment
          }
        }
      }
      error {
        message
        inputErrors {
          percentage
          period
          requestCount
        }
      }
    }
  }
`);

const TargetSettingsPage_UpdateTargetDangerousChangeClassificationMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetDangerousChangeClassificationMutation(
    $input: UpdateTargetDangerousChangeClassificationInput!
  ) {
    updateTargetDangerousChangeClassification(input: $input) {
      ok {
        target {
          id
          failDiffOnDangerousChange
        }
      }
      error {
        message
      }
    }
  }
`);

const TargetSettingsPage_UpdateTargetAppDeploymentProtectionConfigurationMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetAppDeploymentProtectionConfigurationMutation(
    $input: UpdateTargetAppDeploymentProtectionConfigurationInput!
  ) {
    updateTargetAppDeploymentProtectionConfiguration(input: $input) {
      ok {
        target {
          id
          appDeploymentProtectionConfiguration {
            ...TargetSettings_AppDeploymentProtectionConfigurationFragment
          }
        }
      }
      error {
        message
        inputErrors {
          minDaysInactive
          minDaysSinceCreation
          maxTrafficPercentage
          trafficPeriodDays
        }
      }
    }
  }
`);

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

export const BreakingChanges = () => {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [mutation, updateValidation] = useMutation(
    TargetSettingsPage_UpdateTargetConditionalBreakingChangeConfigurationMutation,
  );
  const [dangerousAsBreaking, updateTargetDangerousChangeClassification] = useMutation(
    TargetSettingsPage_UpdateTargetDangerousChangeClassificationMutation,
  );
  const [targetSettings] = useQuery({
    query: TargetSettingsPage_TargetSettingsQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
      targetsSelector: {
        organizationSlug,
        projectSlug,
      },
      organizationSelector: {
        organizationSlug,
      },
    },
  });

  const configuration = useFragment(
    TargetSettings_ConditionalBreakingChangeConfigurationFragment,
    targetSettings.data?.target?.conditionalBreakingChangeConfiguration,
  );

  const considerDangerousAsBreaking =
    targetSettings?.data?.target?.failDiffOnDangerousChange || false;
  const isEnabled = configuration?.isEnabled || false;
  const possibleTargets = targetSettings.data?.targets.edges.map(edge => edge.node);
  const { toast } = useToast();

  const maxPeriod = targetSettings.data?.organization?.usageRetentionInDays ?? 30;
  const schema = useMemo(() => breakingChangesFormSchema(maxPeriod), [maxPeriod]);
  const form = useForm<BreakingChangesFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(schema),
    // Follows the target, so the rules show what is saved.
    values: {
      percentage: configuration?.percentage || 0,
      requestCount: configuration?.requestCount || 1,
      period: configuration?.period || targetSettings.data?.organization?.usageRetentionInDays || 0,
      breakingChangeFormula:
        configuration?.breakingChangeFormula ?? BreakingChangeFormulaType.Percentage,
      targetIds: configuration?.targets.map(t => t.id) || [],
      excludedClients: configuration?.excludedClients ?? [],
      excludedAppDeployments: configuration?.excludedAppDeployments ?? [],
    },
  });

  async function onSubmit(values: BreakingChangesFormValues) {
    const result = await updateValidation({
      input: {
        target: {
          bySelector: {
            organizationSlug,
            projectSlug,
            targetSlug,
          },
        },
        conditionalBreakingChangeConfiguration: {
          ...values,
          /**
           * In case the input gets messed up, fallback to default values in cases
           * where it won't matter based on the selected formula.
           */
          requestCount:
            values.breakingChangeFormula === BreakingChangeFormulaType.Percentage &&
            (typeof values.requestCount !== 'number' || values.requestCount < 1)
              ? 1
              : values.requestCount,
          percentage:
            values.breakingChangeFormula === BreakingChangeFormulaType.RequestCount &&
            (typeof values.percentage !== 'number' || values.percentage < 0)
              ? 0
              : values.percentage,
        },
      },
    });
    const error = result.data?.updateTargetConditionalBreakingChangeConfiguration.error;
    if (result.error || error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error?.message || error?.message,
      });
      for (const name of ['percentage', 'requestCount', 'period'] as const) {
        const message = error?.inputErrors[name];
        if (message) {
          form.setError(name, { message });
        }
      }
    } else {
      toast({
        variant: 'default',
        title: 'Success',
        description: 'Conditional breaking changes settings updated successfully',
      });
    }
  }

  return (
    <>
      <SubPageLayout>
        <SubPageLayoutHeader
          subPageTitle="Fail Checks for Dangerous Changes"
          description={
            <>
              <p>
                Dangerous changes are not technically breaking the protocol, but could cause issues
                for consumers of the schema. Failing schema checks for dangerous changes helps
                safeguard against these situations by requiring approval for dangerous changes.
              </p>
              <p>Before enabling this feature, be sure "contextId" is used on schema checks.</p>
            </>
          }
          docsLink={{
            href: '/schema-registry/management/targets#dangerous-changes',
            text: 'Learn more',
          }}
          sideContent={
            targetSettings.fetching ? (
              <Spinner />
            ) : (
              <Switch
                checked={considerDangerousAsBreaking}
                onCheckedChange={async failDiffOnDangerousChange => {
                  await updateTargetDangerousChangeClassification({
                    input: {
                      failDiffOnDangerousChange,
                      target: {
                        bySelector: {
                          targetSlug,
                          projectSlug,
                          organizationSlug,
                        },
                      },
                    },
                  });
                }}
                disabled={dangerousAsBreaking.fetching}
              />
            )
          }
        />

        {dangerousAsBreaking.error && (
          <span className="ml-2 text-critical">
            {dangerousAsBreaking.error?.graphQLErrors[0]?.message ??
              dangerousAsBreaking.error.message}
          </span>
        )}
        <DangerousChangeTypeForm
          considerDangerousAsBreaking={considerDangerousAsBreaking}
          initialFailAllDangerousChanges={
            targetSettings.data?.target?.failAllDangerousChanges ?? true
          }
          initialFailingChangeTypes={targetSettings.data?.target?.failDangerousChangeTypes ?? []}
        />
      </SubPageLayout>
      <SubPageLayout>
        <SubPageLayoutHeader
          subPageTitle="Conditional Breaking Changes"
          description="Conditional Breaking Changes can change the behavior of schema checks, based on real traffic data sent to Hive."
          docsLink={{
            href: '/schema-registry/management/targets#conditional-breaking-changes',
            text: 'Learn more',
          }}
          sideContent={
            targetSettings.fetching ? (
              <Spinner />
            ) : (
              <Switch
                checked={isEnabled}
                onCheckedChange={async isEnabled => {
                  await updateValidation({
                    input: {
                      target: {
                        bySelector: {
                          organizationSlug,
                          targetSlug,
                          projectSlug,
                        },
                      },
                      conditionalBreakingChangeConfiguration: {
                        isEnabled,
                      },
                    },
                  });
                }}
                disabled={mutation.fetching}
              />
            )
          }
        />
        <BreakingChangesForm
          form={form}
          onSubmit={onSubmit}
          enabled={isEnabled}
          maxPeriod={maxPeriod}
          targets={possibleTargets ?? []}
          clientExclusion={(field, targetIds) => (
            <ClientExclusion
              selectedTargetIds={targetIds}
              clientsFromSettings={configuration?.excludedClients ?? []}
              retentionInDays={maxPeriod}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={options => field.onChange(options.map(o => o.value))}
              disabled={field.disabled}
            />
          )}
          appDeploymentExclusion={field => (
            <AppDeploymentExclusion
              appDeploymentsFromSettings={configuration?.excludedAppDeployments ?? []}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={options => field.onChange(options.map(o => o.value))}
              disabled={field.disabled}
            />
          )}
          error={mutation.error?.graphQLErrors[0]?.message ?? mutation.error?.message}
        />
      </SubPageLayout>
    </>
  );
};

export const AppDeploymentProtection = () => {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [mutation, updateProtection] = useMutation(
    TargetSettingsPage_UpdateTargetAppDeploymentProtectionConfigurationMutation,
  );
  const [targetSettings] = useQuery({
    query: TargetSettingsPage_TargetSettingsQuery,
    variables: {
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
      targetsSelector: {
        organizationSlug,
        projectSlug,
      },
      organizationSelector: {
        organizationSlug,
      },
    },
  });

  const configuration = useFragment(
    TargetSettings_AppDeploymentProtectionConfigurationFragment,
    targetSettings.data?.target?.appDeploymentProtectionConfiguration,
  );

  const isEnabled = configuration?.isEnabled || false;
  const { toast } = useToast();

  const form = useForm<AppDeploymentProtectionFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(AppDeploymentProtectionFormSchema),
    // Follows the target, so the rules show what is saved.
    values: {
      minDaysInactive: configuration?.minDaysInactive ?? 30,
      minDaysSinceCreation: configuration?.minDaysSinceCreation ?? 3,
      maxTrafficPercentage: configuration?.maxTrafficPercentage ?? 1.0,
      trafficPeriodDays: configuration?.trafficPeriodDays ?? 30,
      ruleLogic: configuration?.ruleLogic ?? AppDeploymentProtectionRuleLogicType.And,
    },
  });

  async function onSubmit(values: AppDeploymentProtectionFormValues) {
    const result = await updateProtection({
      input: {
        target: {
          bySelector: {
            organizationSlug,
            projectSlug,
            targetSlug,
          },
        },
        appDeploymentProtectionConfiguration: {
          minDaysInactive: values.minDaysInactive,
          minDaysSinceCreation: values.minDaysSinceCreation,
          maxTrafficPercentage: values.maxTrafficPercentage,
          trafficPeriodDays: values.trafficPeriodDays,
          ruleLogic: values.ruleLogic,
        },
      },
    });
    const error = result.data?.updateTargetAppDeploymentProtectionConfiguration.error;
    if (result.error || error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error?.message || error?.message,
      });
      for (const name of [
        'minDaysInactive',
        'minDaysSinceCreation',
        'maxTrafficPercentage',
        'trafficPeriodDays',
      ] as const) {
        const message = error?.inputErrors[name];
        if (message) {
          form.setError(name, { message });
        }
      }
    } else {
      toast({
        variant: 'default',
        title: 'Success',
        description: 'App deployment protection settings updated successfully',
      });
    }
  }

  return (
    <>
      <SubPageLayout>
        <SubPageLayoutHeader
          subPageTitle="App Deployment Protection"
          description={
            <>
              <p>
                Protect app deployments from being accidentally retired while still in use. When
                enabled, the CLI will block retirement if the deployment has been active within the
                specified period or exceeds the traffic threshold.
              </p>
              <p>
                Use{' '}
                <code className="rounded-sm bg-surface-code px-1 py-0.5 text-xs">
                  hive app:retire --force
                </code>{' '}
                to bypass protection.
              </p>
            </>
          }
          docsLink={{
            href: '/schema-registry/app-deployments#retire-an-app-deployment',
            text: 'Learn more',
          }}
          sideContent={
            targetSettings.fetching ? (
              <Spinner />
            ) : (
              <Switch
                checked={isEnabled}
                onCheckedChange={async isEnabled => {
                  await updateProtection({
                    input: {
                      target: {
                        bySelector: {
                          organizationSlug,
                          projectSlug,
                          targetSlug,
                        },
                      },
                      appDeploymentProtectionConfiguration: {
                        isEnabled,
                      },
                    },
                  });
                }}
                disabled={mutation.fetching}
              />
            )
          }
        />
        <AppDeploymentProtectionForm
          form={form}
          onSubmit={onSubmit}
          enabled={isEnabled}
          error={mutation.error?.graphQLErrors[0]?.message ?? mutation.error?.message}
        />
      </SubPageLayout>
    </>
  );
};

function TargetSlug() {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const router = useRouter();
  const { toast } = useToast();

  const [_slugMutation, slugMutate] = useMutation(TargetSettingsPage_UpdateTargetSlugMutation);
  const slugForm = useForm({
    mode: 'all',
    resolver: zodResolver(slugFormSchema('Target')),
    defaultValues: {
      slug: targetSlug,
    },
  });

  const onSlugFormSubmit = useCallback(
    async (data: SlugFormValues) => {
      try {
        const result = await slugMutate({
          input: {
            target: {
              bySelector: {
                organizationSlug,
                projectSlug,
                targetSlug,
              },
            },
            slug: data.slug,
          },
        });

        const error = result.error || result.data?.updateTargetSlug.error;

        if (result.data?.updateTargetSlug?.ok) {
          toast({
            variant: 'default',
            title: 'Success',
            description: 'Target slug updated',
          });
          void router.navigate({
            to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
            params: {
              organizationSlug,
              projectSlug,
              targetSlug: result.data.updateTargetSlug.ok.target.slug,
            },
          });
        } else if (error) {
          slugForm.setError('slug', error);
        }
      } catch (error) {
        console.error('error', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update target slug',
        });
      }
    },
    [slugMutate],
  );

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        subPageTitle="Target Slug"
        description={
          <p>
            This is your target's URL namespace on Hive. Changing it{' '}
            <span className="font-bold">will</span> invalidate any existing links to your target.
          </p>
        }
        docsLink={{
          href: '/schema-registry/management/targets#change-slug-of-a-target',
          text: 'Read more in the documentation',
        }}
      />
      <SlugForm
        form={slugForm}
        onSubmit={onSlugFormSubmit}
        prefixText={`${env.appBaseUrl.replace(/https?:\/\//i, '')}/${organizationSlug}/${projectSlug}/`}
      />
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

export function GraphQLEndpointUrl(props: { graphqlEndpointUrl: string | null }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const { toast } = useToast();
  const [mutation, mutate] = useMutation(TargetSettingsPage_UpdateTargetGraphQLEndpointUrl);
  const form = useForm<GraphqlEndpointFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(GraphqlEndpointFormSchema),
    // Follows the target, so the field shows what is saved.
    values: {
      graphqlEndpointUrl: props.graphqlEndpointUrl || '',
    },
    disabled: mutation.fetching,
  });

  async function onSubmit(values: GraphqlEndpointFormValues) {
    const result = await mutate({
      input: {
        target: {
          bySelector: {
            organizationSlug,
            projectSlug,
            targetSlug,
          },
        },
        graphqlEndpointUrl: values.graphqlEndpointUrl === '' ? null : values.graphqlEndpointUrl,
      },
    });
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
  }

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        subPageTitle="GraphQL Endpoint URL"
        description={
          <>
            The endpoint url will be used for querying the target from the{' '}
            <Link
              to="/$organizationSlug/$projectSlug/$targetSlug/laboratory"
              params={{
                organizationSlug,
                projectSlug,
                targetSlug,
              }}
            >
              Hive Laboratory
            </Link>
            .
          </>
        }
      />
      <GraphqlEndpointForm
        form={form}
        onSubmit={onSubmit}
        error={
          mutation.data?.updateTargetGraphQLEndpointUrl.error?.message ??
          mutation.error?.graphQLErrors[0]?.message ??
          mutation.error?.message
        }
      />
    </SubPageLayout>
  );
}

const TargetSettingsPage_UpdateTargetSlugMutation = graphql(`
  mutation TargetSettingsPage_UpdateTargetSlugMutation($input: UpdateTargetSlugInput!) {
    updateTargetSlug(input: $input) {
      ok {
        selector {
          organizationSlug
          projectSlug
          targetSlug
        }
        target {
          id
          slug
        }
      }
      error {
        message
      }
    }
  }
`);

function TargetDelete() {
  const [isModalOpen, toggleModalOpen] = useToggle();

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        subPageTitle="Delete Target"
        description={
          <p>
            Deleting an project also delete all schemas and data associated with it.{' '}
            <strong>This action is not reversible!</strong>
          </p>
        }
        docsLink={{
          href: '/schema-registry/management/targets#delete-a-target',
          text: 'Read more in the documentation',
        }}
      />
      <Button variant="destructive" onClick={toggleModalOpen}>
        Delete Target
      </Button>

      <DeleteTargetModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
    </SubPageLayout>
  );
}

export const TargetSettingsPageQuery = graphql(`
  query TargetSettingsPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    organization: organizationBySlug(organizationSlug: $organizationSlug) {
      id
      slug
      isAppDeploymentsEnabled
      project: projectBySlug(projectSlug: $projectSlug) {
        id
        slug
        type
        target: targetBySlug(targetSlug: $targetSlug) {
          id
          slug
          graphqlEndpointUrl
          viewerCanAccessSettings
          baseSchema
          viewerCanModifySettings
          viewerCanModifyCDNAccessToken
          viewerCanModifyTargetAccessToken
          viewerCanDelete
        }
      }
    }
  }
`);

function TargetInfo(props: { targetId: string }) {
  return (
    <div>
      <ResourceDetails id={props.targetId} label="Target ID" />
    </div>
  );
}

export type SettingsSectionId =
  | 'general'
  | 'base-schema'
  | 'breaking-changes'
  | 'schema-contracts'
  | 'registry-token'
  | 'cdn';

type Section = {
  id: SettingsSectionId;
  label: string;
  to: `/$organizationSlug/$projectSlug/$targetSlug/settings${'' | `/${Exclude<SettingsSectionId, 'general'>}`}`;
  exact?: boolean;
};

/** The sections in nav order. The bare URL is General. */
const sections: readonly Section[] = [
  {
    id: 'general',
    label: 'General',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
    exact: true,
  },
  {
    id: 'base-schema',
    label: 'Base Schema',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/base-schema',
  },
  {
    id: 'breaking-changes',
    label: 'Breaking Changes',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/breaking-changes',
  },
  {
    id: 'schema-contracts',
    label: 'Schema Contracts',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/schema-contracts',
  },
  {
    id: 'registry-token',
    label: 'Registry Tokens',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/registry-token',
  },
  {
    id: 'cdn',
    label: 'CDN Tokens',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/cdn',
  },
];

/** The sections this viewer may open, in nav order; the route loaders and the nav agree through it. */
export function settingsSections(input: {
  target: {
    viewerCanModifySettings: boolean;
    viewerCanModifyTargetAccessToken: boolean;
    viewerCanModifyCDNAccessToken: boolean;
  };
  projectType: ProjectType;
}) {
  const ids = new Set<SettingsSectionId>();
  if (input.target.viewerCanModifySettings) {
    ids.add('general');
    ids.add(input.projectType === ProjectType.Federation ? 'schema-contracts' : 'base-schema');
    ids.add('breaking-changes');
  }
  if (input.target.viewerCanModifyTargetAccessToken) {
    ids.add('registry-token');
  }
  if (input.target.viewerCanModifyCDNAccessToken) {
    ids.add('cdn');
  }
  return sections.filter(section => ids.has(section.id));
}

// The route's loader answered the page document and sent away a viewer who may not be here.
export function TargetSettingsPage() {
  const slugs = useSlugs('target');
  const { organizationSlug } = slugs;
  const [query] = useQuery({ query: TargetSettingsPageQuery, variables: slugs });
  const currentOrganization = query.data?.organization;
  const currentProject = currentOrganization?.project;
  const currentTarget = currentProject?.target;

  if (query.error) {
    return (
      <LayoutContent>
        <QueryError
          organizationSlug={organizationSlug}
          error={query.error}
          showLogoutButton={false}
        />
      </LayoutContent>
    );
  }

  return (
    <>
      <Meta title="Settings" />
      <LayoutContent>
        {currentOrganization && currentProject && currentTarget ? (
          <PageLayout>
            <Navigation
              aria-label="Settings"
              variant="list"
              items={settingsSections({
                target: currentTarget,
                projectType: currentProject.type,
              }).map(section => ({
                label: section.label,
                to: section.to,
                params: slugs,
                exact: section.exact,
                attrs: { 'data-cy': `target-settings-${section.id}-link` },
              }))}
            />
            <PageLayoutContent>
              <div className="space-y-12">
                <Outlet />
              </div>
            </PageLayoutContent>
          </PageLayout>
        ) : null}
      </LayoutContent>
    </>
  );
}

export function TargetSettingsGeneralSection() {
  const slugs = useSlugs('target');
  const [query] = useQuery({ query: TargetSettingsPageQuery, variables: slugs });
  const currentOrganization = query.data?.organization;
  const currentProject = currentOrganization?.project;
  const currentTarget = currentProject?.target;
  if (!currentOrganization || !currentProject || !currentTarget) {
    return null;
  }
  return (
    <>
      <TargetInfo targetId={currentTarget.id} />
      <TargetSlug />
      <GraphQLEndpointUrl graphqlEndpointUrl={currentTarget.graphqlEndpointUrl ?? null} />
      {currentTarget.viewerCanDelete && <TargetDelete />}
    </>
  );
}

export function TargetSettingsRegistryTokensSection() {
  return <RegistryAccessTokens />;
}

export function TargetSettingsBreakingChangesSection() {
  const [query] = useQuery({ query: TargetSettingsPageQuery, variables: useSlugs('target') });
  return (
    <>
      <BreakingChanges />
      {query.data?.organization?.isAppDeploymentsEnabled ? <AppDeploymentProtection /> : null}
    </>
  );
}

export function TargetSettingsBaseSchemaSection() {
  const [query] = useQuery({ query: TargetSettingsPageQuery, variables: useSlugs('target') });
  const currentTarget = query.data?.organization?.project?.target;
  if (!currentTarget) {
    return null;
  }
  return <ExtendBaseSchema baseSchema={currentTarget.baseSchema ?? ''} />;
}

export const DeleteTargetMutation = graphql(`
  mutation deleteTarget($selector: TargetSelectorInput!) {
    deleteTarget(input: { target: { bySelector: $selector } }) {
      ok {
        deletedTargetId
      }
    }
  }
`);

export function DeleteTargetModal(props: { isOpen: boolean; toggleModalOpen: () => void }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [, mutate] = useMutation(DeleteTargetMutation);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete target',
        description: error.message,
      });
    } else {
      toast({
        title: 'Target deleted',
        description: 'The target has been successfully deleted.',
      });
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug/$projectSlug',
        params: {
          organizationSlug,
          projectSlug,
        },
      });
    }
  };

  return (
    <DeleteTargetModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      handleDelete={handleDelete}
    />
  );
}

export function DeleteTargetModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  handleDelete: () => void;
}) {
  return (
    <AlertDialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      title="Delete target"
      description={
        <>
          Every published schema, reported data, and settings associated with this target will be
          permanently deleted.
          <br />
          <strong>This action is irreversible!</strong>
        </>
      }
      confirm={{ label: 'Delete', variant: 'destructive', onClick: props.handleDelete }}
    />
  );
}

export const TargetSettingsPage_UpdateFailingDangerousChangeSettings = graphql(`
  mutation TargetSettingsPage_UpdateFailingDangerousChangeSettings(
    $selector: TargetSelectorInput!
    $failAllDangerousChanges: Boolean!
    $failingChangeTypes: [DangerousChangeType!]!
  ) {
    updateTargetFailingDangerousChanges(
      input: {
        target: { bySelector: $selector }
        all: $failAllDangerousChanges
        failingTypes: $failingChangeTypes
      }
    ) {
      ok {
        target {
          id
          failAllDangerousChanges
          failDangerousChangeTypes
        }
      }
      error {
        message
      }
    }
  }
`);

export function DangerousChangeTypeForm({
  considerDangerousAsBreaking,
  initialFailingChangeTypes,
  initialFailAllDangerousChanges,
}: {
  considerDangerousAsBreaking: boolean;
  initialFailingChangeTypes: DangerousChangeType[];
  initialFailAllDangerousChanges: boolean;
}) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [_, mutate] = useMutation(TargetSettingsPage_UpdateFailingDangerousChangeSettings);
  const { saveStatus, triggerSaveMessage } = useSaveStatus();
  const [error, setError] = useState<{ title: string; description?: string }>();

  const form = useForm<DangerousChangesFormValues>({
    resolver: zodResolver(DangerousChangesFormSchema),
    // Follows the target, so a save settles the form once the new selection comes back.
    values: {
      failingChangeTypes: initialFailingChangeTypes,
      failAllDangerousChanges: initialFailAllDangerousChanges,
    },
  });

  async function onSubmit({
    failingChangeTypes,
    failAllDangerousChanges,
  }: DangerousChangesFormValues) {
    const title = 'Dangerous change types were not updated.';
    try {
      const result = await mutate({
        selector: {
          organizationSlug,
          projectSlug,
          targetSlug,
        },
        failingChangeTypes,
        failAllDangerousChanges,
      });
      if (result.data?.updateTargetFailingDangerousChanges.error?.message || result.error) {
        setError({
          title,
          description:
            result.data?.updateTargetFailingDangerousChanges.error?.message ||
            result.error?.message,
        });
      } else {
        setError(undefined);
        triggerSaveMessage();
      }
    } catch (e) {
      setError({ title, description: e instanceof Error ? e.message : String(e) });
    }
  }

  const { isDirty } = form.formState;

  return (
    <DangerousChangesForm
      form={form}
      onSubmit={onSubmit}
      enabled={considerDangerousAsBreaking}
      status={
        isDirty ? (
          <UnsavedChangesLabel />
        ) : saveStatus === SaveStatus.SAVED ? (
          <SavedLabel />
        ) : saveStatus === SaveStatus.JUST_SAVED ? (
          <JustSavedLabel />
        ) : null
      }
      error={error}
    />
  );
}

enum SaveStatus {
  JUST_SAVED = 'JUST_SAVED',
  SAVED = 'SAVED',
}

export const useSaveStatus = () => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSaveMessage = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setSaveStatus(SaveStatus.JUST_SAVED);

    timerRef.current = setTimeout(() => {
      setSaveStatus(SaveStatus.SAVED);
    }, 5000);
  };

  // Cleanup timer if the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveStatus, triggerSaveMessage };
};
