import { rules as graphqlEslintRules } from '@graphql-eslint/eslint-plugin';
import { rules } from '../src/engine/rules/index.js';

// Rule meta drives the policy settings UI and config validation, so the engine rules must
// expose exactly what graphql-eslint 3.20.1 does. Imports src/engine only, before
// patchRulesConfig in src/rules.ts mutates graphql-eslint's meta.
describe('engine rule meta', () => {
  it.each(Object.keys(rules) as Array<keyof typeof rules>)('%s matches graphql-eslint', name => {
    expect(rules[name].meta).toEqual(graphqlEslintRules[name].meta);
  });

  it('keeps graphql-eslint key order', () => {
    const schemaRuleNames = Object.keys(graphqlEslintRules).filter(name =>
      Object.hasOwn(rules, name),
    );
    expect(Object.keys(rules)).toEqual(schemaRuleNames);
  });
});
