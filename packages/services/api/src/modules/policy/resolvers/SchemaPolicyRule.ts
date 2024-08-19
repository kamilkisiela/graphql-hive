import type { SchemaPolicyRuleResolvers } from './../../../__generated__/types.next';

export const SchemaPolicyRule: SchemaPolicyRuleResolvers = {
  id: r => r.name,
  description: r => r.description,
  configJsonSchema: r => r.schema,
  recommended: r => r.recommended,
  documentationUrl: r => r.url ?? null,
};
