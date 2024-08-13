import { SchemaPolicyApiProvider } from '../providers/schema-policy-api.provider';
import { serializeSeverity } from '../utils';
import type { SchemaPolicyResolvers } from './../../../__generated__/types.next';

export const SchemaPolicy: SchemaPolicyResolvers = {
  id: policy => policy.id,
  allowOverrides: policy => policy.allowOverrides,
  rules: async (policy, _, { injector }) => {
    const availableRules = await injector.get(SchemaPolicyApiProvider).listAvailableRules();

    return Object.entries(policy.config).map(([ruleId, config]) => ({
      rule: availableRules.find(r => r.name === ruleId)!,
      severity: serializeSeverity(config[0]),
      configuration: config[1] || null,
    }));
  },
};
