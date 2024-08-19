import { SchemaPolicyApiProvider } from '../providers/schema-policy-api.provider';
import { SchemaPolicyProvider } from '../providers/schema-policy.provider';
import { serializeSeverity } from '../utils';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<TargetResolvers, 'schemaPolicy' | '__isTypeOf'> = {
  schemaPolicy: async (target, _, { injector }) => {
    const { mergedPolicy, orgLevel, projectLevel } = await injector
      .get(SchemaPolicyProvider)
      .getCalculatedTargetPolicyForApi({
        project: target.projectId,
        organization: target.orgId,
        target: target.id,
      });

    if (!mergedPolicy) {
      return null;
    }

    const availableRules = await injector.get(SchemaPolicyApiProvider).listAvailableRules();
    const rules = Object.entries(mergedPolicy).map(([ruleId, config]) => ({
      rule: availableRules.find(r => r.name === ruleId)!,
      severity: serializeSeverity(config[0]),
      configuration: config[1],
    }));

    return {
      mergedRules: rules,
      organizationPolicy: orgLevel,
      projectPolicy: projectLevel,
    };
  },
};
