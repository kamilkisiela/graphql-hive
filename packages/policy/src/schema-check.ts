import { Linter, Rule } from 'eslint';
import { parseForESLint, rules } from '@graphql-eslint/eslint-plugin';
import { Policy } from './types';

const engine = new Linter();
engine.defineRules(rules as { [name: string]: Rule.RuleModule });
engine.defineParser('graphql', { parseForESLint });

export async function schemaPolicyCheck(input: {
  sdl: string;
  policy: Policy;
}) {
  const output = await engine.verify(input.sdl, {
    parser: 'graphql',
    parserOptions: {
      schema: input.sdl,
      skipGraphQLConfig: true,
      schemaOptions: {
        assumeValid: true,
      },
    },
    rules: input.policy,
  });

  return output;
}
