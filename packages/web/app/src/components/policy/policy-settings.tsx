import { ReactElement, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from 'urql';
import { DataWrapper } from '@/components/ui/data-wrapper';
import { Button } from '@/components/ui/primitives/button/button';
import { Form } from '@/components/ui/primitives/form/form';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  PolicySettings_SchemaPolicyFragmentFragment,
  RuleInstanceSeverityLevel,
  SchemaPolicyInput,
} from '@/gql/graphql';
import type { ResultOf } from '@graphql-typed-document-node/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { Callout } from '../ui/callout';
import { PolicyListItem } from './policy-list-item';
import { PolicyFormSchema, type PolicyFormValues } from './rules-configuration';
import * as styles from './policy-settings.css';

const PolicySettingsAvailableRulesQuery = graphql(`
  query PolicySettingsAvailableRulesQuery {
    schemaPolicyRules {
      id
      configJsonSchema
      ...PolicyListItem_RuleInfoFragment
    }
  }
`);

export const PolicySettings_SchemaPolicyFragment = graphql(`
  fragment PolicySettings_SchemaPolicyFragment on SchemaPolicy {
    id
    allowOverrides
    rules {
      rule {
        id
      }
      severity
      configuration
    }
  }
`);

export type AvailableRulesList = ResultOf<
  typeof PolicySettingsAvailableRulesQuery
>['schemaPolicyRules'];

/** What the page can render above the rules, next to the form's own state. */
export type PolicyFormControls = {
  allowOverrides: boolean;
  setAllowOverrides: (value: boolean) => void;
};

function PolicySettingsListForm({
  rulesInParent,
  saving,
  onSave,
  currentState,
  availableRules,
  error,
  children,
}: {
  saving?: boolean;
  rulesInParent?: string[];
  error?: string;
  onSave: null | ((values: SchemaPolicyInput, allowOverrides: boolean) => Promise<void>);
  availableRules: AvailableRulesList;
  currentState?: PolicySettings_SchemaPolicyFragmentFragment | null;
  children?: (controls: PolicyFormControls) => ReactElement;
}): ReactElement {
  const initialState = useMemo<PolicyFormValues>(() => {
    return {
      allowOverrides: currentState?.allowOverrides ?? true,
      rules:
        currentState?.rules.reduce(
          (acc, ruleInstance) => {
            return {
              ...acc,
              [ruleInstance.rule.id]: {
                enabled: true,
                severity: ruleInstance.severity,
                config: ruleInstance.configuration,
              },
            };
          },
          {} as PolicyFormValues['rules'],
        ) ?? {},
    };
  }, [currentState]);
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(PolicyFormSchema),
    values: initialState,
    mode: 'onChange',
  });
  const allowOverrides = useWatch({ control: form.control, name: 'allowOverrides' });
  const { isDirty, isValid } = form.formState;

  async function onSubmit(values: PolicyFormValues) {
    const asInput: SchemaPolicyInput = {
      rules: Object.entries(values.rules)
        .filter(([, ruleConfig]) => ruleConfig.enabled)
        .map(([ruleId, ruleConfig]) => ({
          ruleId,
          severity: ruleConfig.severity,
          configuration:
            ruleConfig.enabled && ruleConfig.severity !== RuleInstanceSeverityLevel.Off
              ? ruleConfig.config
              : null,
        })),
    };

    await onSave?.(asInput, values.allowOverrides);
    form.reset();
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <div>
        {children
          ? children({
              allowOverrides,
              setAllowOverrides: value =>
                form.setValue('allowOverrides', value, { shouldDirty: true, shouldValidate: true }),
            })
          : null}
        <div className={styles.policySettingsListFormDiv}>
          {isDirty ? <p className={styles.policySettingsListFormP}>Unsaved changes</p> : null}

          <Button disabled={!isDirty || saving || !isValid || !onSave} type="submit">
            Update Policy
          </Button>
        </div>
        {error ? (
          <Callout type="error" className={styles.policySettingsListFormCallout}>
            <b>Oops, something went wrong.</b>
            <br />
            {error}
          </Callout>
        ) : null}
      </div>
      <div className={styles.policySettingsListFormDiv2}>
        {availableRules.map(availableRule => (
          <PolicyListItem
            disabled={!onSave}
            overridingParentRule={rulesInParent?.includes(availableRule.id) ?? false}
            key={availableRule.id}
            ruleInfo={availableRule}
          />
        ))}
      </div>
    </Form>
  );
}

export function PolicySettings({
  rulesInParent,
  saving,
  currentState,
  onSave,
  error,
  children,
}: {
  saving?: boolean;
  rulesInParent?: string[];
  currentState?: null | FragmentType<typeof PolicySettings_SchemaPolicyFragment>;
  onSave: null | ((values: SchemaPolicyInput, allowOverrides: boolean) => Promise<void>);
  error?: string;
  children?: (controls: PolicyFormControls) => ReactElement;
}): ReactElement {
  const [availableRules] = useQuery({
    query: PolicySettingsAvailableRulesQuery,
    variables: {},
  });
  const activePolicy = useFragment(PolicySettings_SchemaPolicyFragment, currentState);

  return (
    <>
      {!onSave && 'You have read only access to this policy.'}
      <DataWrapper query={availableRules} organizationSlug={null}>
        {query => (
          <PolicySettingsListForm
            saving={saving}
            rulesInParent={rulesInParent}
            currentState={activePolicy}
            onSave={onSave}
            error={error}
            availableRules={query.data.schemaPolicyRules}
          >
            {children}
          </PolicySettingsListForm>
        )}
      </DataWrapper>
    </>
  );
}
