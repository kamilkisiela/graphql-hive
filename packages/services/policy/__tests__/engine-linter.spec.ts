import { lint, type RulesConfig } from '../src/engine/linter.js';
import { createInputValidationSchema, schemaPolicyCheck } from '../src/policy';
import { composedSchema, subgraphSdl } from './fixtures/schemas';
import { storedPolicies } from './fixtures/stored-policies';

const validation = createInputValidationSchema();

// The engine never produces fixes or suggestions; everything else must match ESLint exactly.
async function eslintMessages(input: { source: string; schema: string; policy: RulesConfig }) {
  const messages = await schemaPolicyCheck({
    source: input.source,
    schema: input.schema,
    policy: input.policy as any,
  });
  return messages.map(({ fix: _fix, suggestions: _suggestions, ...message }) => message);
}

async function expectSameAsEslint(input: { source: string; schema: string; policy: RulesConfig }) {
  const expected = await eslintMessages({ ...input, policy: structuredClone(input.policy) });
  expect(lint({ ...input, rules: structuredClone(input.policy) })).toEqual(expected);
}

describe('engine linter matches ESLint', () => {
  it.each(storedPolicies.map((policy, index) => [index, policy] as const))(
    'stored policy #%i',
    async (_, storedPolicy) => {
      // Validation applies the Ajv option defaults the API applies before linting.
      const policy = validation.parse(structuredClone(storedPolicy)) as RulesConfig;
      const composed = { source: composedSchema, schema: composedSchema, policy };
      const subgraph = { source: subgraphSdl, schema: composedSchema, policy };

      expect(lint({ ...composed, rules: structuredClone(policy) })).toEqual(
        await eslintMessages(composed),
      );
      expect(lint({ ...subgraph, rules: structuredClone(policy) })).toEqual(
        await eslintMessages(subgraph),
      );
    },
  );

  const everyRule = Object.fromEntries(
    storedPolicies.flatMap(policy => Object.entries(policy)),
  ) as RulesConfig;

  it('reports a source syntax error as a fatal parsing error', async () => {
    const input = { source: 'type Query {', schema: composedSchema, policy: everyRule };
    const messages = lint({ ...input, rules: everyRule });

    expect(messages).toEqual(await eslintMessages(input));
    expect(messages[0]).toMatchObject({ ruleId: null, fatal: true });
  });

  it('reports an invalid schema as a fatal parsing error', async () => {
    const input = { source: subgraphSdl, schema: 'type Query { foo: Missing }', policy: everyRule };
    const messages = lint({ ...input, rules: everyRule });

    expect(messages).toEqual(await eslintMessages(input));
    expect(messages[0].message).toContain('Error while loading schema');
  });

  it('reports an unknown rule', async () => {
    const input = {
      source: composedSchema,
      schema: composedSchema,
      policy: { 'not-a-rule': [2] } as RulesConfig,
    };

    await expectSameAsEslint(input);
  });

  it('accepts string severities and skips disabled rules', async () => {
    const input = {
      source: composedSchema,
      schema: composedSchema,
      policy: {
        'require-description': ['warn', { types: true }],
        'no-typename-prefix': ['error'],
        'strict-id-in-types': ['off'],
        'no-root-type': [0, { disallow: ['subscription'] }],
      } as RulesConfig,
    };

    await expectSameAsEslint(input);
  });

  it('ignores a byte order mark', async () => {
    const input = { source: `﻿${composedSchema}`, schema: composedSchema, policy: everyRule };

    await expectSameAsEslint(input);
  });
});
