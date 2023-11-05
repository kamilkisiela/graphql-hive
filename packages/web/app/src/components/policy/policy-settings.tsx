import { ReactElement, useMemo, useRef } from 'react';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  PolicySettings_SchemaPolicyFragmentFragment,
  RuleInstanceSeverityLevel,
  SchemaPolicyInput,
} from '@/graphql';
import type { ResultOf } from '@graphql-typed-document-node/core';
import { Callout, DataWrapper } from '../v2';
import { PolicyListItem } from './policy-list-item';
import { buildValidationSchema, PolicyFormValues } from './rules-configuration';

const PolicySettingsAvailableRulesQuery = graphql(`
  query PolicySettingsAvailableRulesQuery {
    schemaPolicyRules {
      id
      configJsonSchema
      ...PolicyListItem_RuleInfoFragment
    }
  }
`);

const PolicySettings_SchemaPolicyFragment = graphql(`
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
  onSave: (values: SchemaPolicyInput, allowOverrides: boolean) => Promise<void>;
  availableRules: AvailableRulesList;
  currentState?: PolicySettings_SchemaPolicyFragmentFragment | null;
  children?: (form: FormikProps<PolicyFormValues>) => ReactElement;
}): ReactElement {
  const onSubmit = useRef(
    (values: PolicyFormValues, formikHelpers: FormikHelpers<PolicyFormValues>) => {
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

      void onSave(asInput, values.allowOverrides).then(() => formikHelpers.resetForm());
    },
  );
  const validationSchema = useMemo(() => buildValidationSchema(availableRules), [availableRules]);
  const initialState = useMemo(() => {
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

  return (
    <Formik<PolicyFormValues>
      initialValues={initialState}
      validationSchema={validationSchema}
      onSubmit={onSubmit.current}
      enableReinitialize
    >
      {props => (
        <>
          {children ? children(props) : null}
          <div className="flex items-center justify-end">
            {props.dirty ? <p className="pr-2 text-sm text-gray-500">Unsaved changes</p> : null}
            <Button
              disabled={!props.dirty || saving}
              type="submit"
              variant="default"
              onClick={() => props.submitForm()}
            >
              Update Policy
            </Button>
          </div>
          {error ? (
            <Callout type="error" className="mx-auto w-2/3">
              <b>Oops, something went wrong.</b>
              <br />
              {error}
            </Callout>
          ) : null}
          <div className="grid grid-cols-1 divide-y divide-gray-800">
            {availableRules.map(availableRule => (
              <PolicyListItem
                overridingParentRule={rulesInParent?.includes(availableRule.id) ?? false}
                key={availableRule.id}
                ruleInfo={availableRule}
              />
            ))}
          </div>
        </>
      )}
    </Formik>
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
  onSave: (values: SchemaPolicyInput, allowOverrides: boolean) => Promise<void>;
  error?: string;
  children?: (form: FormikProps<PolicyFormValues>) => ReactElement;
}): ReactElement {
  const [availableRules] = useQuery({
    query: PolicySettingsAvailableRulesQuery,
    variables: {},
  });
  const activePolicy = useFragment(PolicySettings_SchemaPolicyFragment, currentState);

  return (
    <DataWrapper query={availableRules}>
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
  );
}
