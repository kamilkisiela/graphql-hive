import { RuleInstanceSeverityLevel, SchemaPolicyInput } from '@app/gql/graphql';
import { graphql } from './gql';

export const TargetCalculatedPolicy = graphql(`
  query TargetCalculatedPolicy($selector: TargetSelectorInput!) {
    target(selector: $selector) {
      id
      schemaPolicy {
        mergedRules {
          ...SchemaPolicyRuleInstanceFields
        }
        projectPolicy {
          id
          rules {
            ...SchemaPolicyRuleInstanceFields
          }
        }
        organizationPolicy {
          id
          allowOverrides
          rules {
            ...SchemaPolicyRuleInstanceFields
          }
        }
      }
    }
  }

  fragment SchemaPolicyRuleInstanceFields on SchemaPolicyRuleInstance {
    rule {
      id
    }
    severity
    configuration
  }
`);

export const OrganizationAndProjectsWithSchemaPolicy = graphql(`
  query OrganizationAndProjectsWithSchemaPolicy($organization: ID!) {
    organization(selector: { organization: $organization }) {
      organization {
        id
        schemaPolicy {
          id
        }
        projects {
          nodes {
            id
            schemaPolicy {
              id
            }
          }
        }
      }
    }
  }
`);

export const UpdateSchemaPolicyForOrganization = graphql(`
  mutation UpdateSchemaPolicyForOrganization(
    $selector: OrganizationSelectorInput!
    $policy: SchemaPolicyInput!
    $allowOverrides: Boolean!
  ) {
    updateSchemaPolicyForOrganization(
      selector: $selector
      policy: $policy
      allowOverrides: $allowOverrides
    ) {
      error {
        message
      }
      ok {
        organization {
          id
          schemaPolicy {
            id
          }
        }
        updatedPolicy {
          id
          allowOverrides
          updatedAt
          rules {
            rule {
              id
            }
            severity
            configuration
          }
        }
      }
    }
  }
`);

export const UpdateSchemaPolicyForProject = graphql(`
  mutation UpdateSchemaPolicyForProject(
    $selector: ProjectSelectorInput!
    $policy: SchemaPolicyInput!
  ) {
    updateSchemaPolicyForProject(selector: $selector, policy: $policy) {
      error {
        message
      }
      ok {
        project {
          id
          schemaPolicy {
            id
          }
        }
        updatedPolicy {
          id
          updatedAt
          rules {
            rule {
              id
            }
            severity
            configuration
          }
        }
      }
    }
  }
`);

export const INVALID_RULE_POLICY = {
  rules: [
    {
      ruleId: 'require-kamil-to-merge-my-prs',
      severity: RuleInstanceSeverityLevel.Error,
      configuration: {},
    },
  ],
};

export const INVALID_RULE_CONFIG_POLICY: SchemaPolicyInput = {
  rules: [
    {
      ruleId: 'require-description',
      severity: RuleInstanceSeverityLevel.Error,
      configuration: {
        nonExisting: true,
      },
    },
  ],
};

export const EMPTY_RULE_CONFIG_POLICY: SchemaPolicyInput = {
  rules: [
    {
      ruleId: 'require-description',
      severity: RuleInstanceSeverityLevel.Error,
      configuration: {},
    },
  ],
};

export const VALID_POLICY: SchemaPolicyInput = {
  rules: [
    {
      ruleId: 'require-description',
      severity: RuleInstanceSeverityLevel.Error,
      configuration: {
        types: true,
      },
    },
  ],
};

export const DESCRIPTION_RULE = {
  ruleId: 'description-style',
  severity: RuleInstanceSeverityLevel.Warning,
  configuration: { style: 'inline' },
};

export const LONGER_VALID_POLICY: SchemaPolicyInput = {
  rules: [
    {
      ruleId: 'require-description',
      severity: RuleInstanceSeverityLevel.Error,
      configuration: {
        types: true,
        FieldDefinition: true,
      },
    },
    DESCRIPTION_RULE,
  ],
};
