import { ReactElement } from 'react';
import type { JSONSchema } from 'json-schema-typed';
import { InfoIcon } from 'lucide-react';
import { Markdown } from '@/components/ui/markdown';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { FragmentType, graphql, useFragment } from '@/gql';
import { RuleInstanceSeverityLevel } from '@/gql/graphql';
import { DocsLink } from '../ui/docs-note';
import { useConfigurationHelper } from './form-helper';
import { PolicyRuleConfig } from './rules-configuration';
import { SeverityLevelToggle } from './rules-configuration/severity-toggle';
import * as styles from './policy-list-item.css';

const PolicyListItem_RuleInfoFragment = graphql(`
  fragment PolicyListItem_RuleInfoFragment on SchemaPolicyRule {
    id
    description
    recommended
    documentationUrl
    configJsonSchema
  }
`);

function extractBaseSchema(configJsonSchema: JSONSchema | null | undefined): JSONSchema | null {
  if (
    configJsonSchema &&
    typeof configJsonSchema === 'object' &&
    configJsonSchema.type === 'array' &&
    typeof configJsonSchema.items === 'object' &&
    configJsonSchema.items.type === 'object'
  ) {
    return configJsonSchema.items;
  }

  return null;
}

export function PolicyListItem(props: {
  disabled?: boolean;
  ruleInfo: FragmentType<typeof PolicyListItem_RuleInfoFragment>;
  overridingParentRule: boolean;
}): ReactElement {
  const config = useConfigurationHelper();
  const ruleInfo = useFragment(PolicyListItem_RuleInfoFragment, props.ruleInfo);
  const { enabled, toggleRuleState, severity } = config.ruleConfig(ruleInfo.id);
  const shouldShowRuleConfig =
    !props.overridingParentRule ||
    (props.overridingParentRule && severity !== RuleInstanceSeverityLevel.Off);

  return (
    <>
      <div className={styles.policyListItemDiv} data-rule={ruleInfo.id}>
        <div className={styles.policyListItemDiv2}>
          <div className={styles.policyListItemDiv3}>
            <Checkbox
              id={ruleInfo.id}
              value={ruleInfo.id}
              checked={enabled}
              disabled={props.disabled}
              onCheckedChange={newState => toggleRuleState(newState as boolean)}
            />
          </div>
          <div className={styles.policyListItemDiv4}>
            <div className={styles.policyListItemDiv5}>
              <label htmlFor={ruleInfo.id} className={styles.policyListItemLabel}>
                {ruleInfo.id}
                <Popover
                  trigger={
                    <button
                      type="button"
                      aria-label="About this rule"
                      className={styles.policyListItemButton}
                    >
                      <InfoIcon className={styles.policyListItemInfoIcon} />
                    </button>
                  }
                  openOnHover
                  side="top"
                  align="start"
                  width="xl"
                  content={
                    <div className={styles.policyListItemDiv6}>
                      <Markdown
                        content={ruleInfo.description}
                        className={styles.policyListItemMarkdown}
                      />
                      <br />
                      {ruleInfo.documentationUrl ? (
                        <DocsLink href={ruleInfo.documentationUrl} text="read more" />
                      ) : null}
                    </div>
                  }
                />
              </label>
            </div>
            {enabled ? (
              <div className={styles.policyListItemDiv7}>
                <div>
                  <SeverityLevelToggle canTurnOff={props.overridingParentRule} rule={ruleInfo.id} />
                </div>
                <div className={styles.policyListItemDiv8}>
                  {shouldShowRuleConfig && (
                    <PolicyRuleConfig
                      rule={ruleInfo.id}
                      configJsonSchema={extractBaseSchema(ruleInfo.configJsonSchema)}
                      baseDocumentationUrl={ruleInfo.documentationUrl ?? undefined}
                    />
                  )}
                </div>
              </div>
            ) : null}
            {props.overridingParentRule && enabled ? (
              <div className={styles.policyListItemDiv9}>
                <p className={styles.policyListItemP}>!</p>
                You are {severity === RuleInstanceSeverityLevel.Off ? 'disabling' : 'overriding'} a
                rule configured at the organization level
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
