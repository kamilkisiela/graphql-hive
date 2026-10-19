import { rules } from './engine/rules';
import type { GraphQLESLintRule } from './engine/types';

type AllRulesType = typeof rules;
type RuleName = keyof AllRulesType;

// Some rules have configurations for operations (like "alphabetize") and we do not want to expose them.
function patchRulesConfig<T extends RuleName>(
  ruleName: T,
  ruleDef: AllRulesType[T],
): GraphQLESLintRule {
  // meta.schema is a JSONSchema union; the edits below rely on the shapes of these two rules.
  const schema = ruleDef.meta.schema as any;
  switch (ruleName) {
    case 'alphabetize': {
      // Remove operation-specific configurations
      delete schema.items.properties.selections;
      delete schema.items.properties.variables;
      break;
    }
    case 'naming-convention': {
      // Remove operation-specific configurations
      delete schema.items.properties.VariableDefinition;
      delete schema.items.properties.OperationDefinition;

      // Get rid of "definitions" references becuse it's breaking Monaco editor in the frontend
      Object.entries(schema.items.properties).forEach(([, propDef]) => {
        if (propDef && typeof propDef === 'object' && 'oneOf' in propDef) {
          propDef.oneOf = [schema.definitions.asObject, schema.definitions.asString];
        }
      });
      schema.items.patternProperties = {
        '^(Argument|DirectiveDefinition|EnumTypeDefinition|EnumValueDefinition|FieldDefinition|InputObjectTypeDefinition|InputValueDefinition|InterfaceTypeDefinition|ObjectTypeDefinition|ScalarTypeDefinition|UnionTypeDefinition)(.+)?$':
          {
            oneOf: [schema.definitions.asObject, schema.definitions.asString],
          },
      };
      delete schema.definitions;

      break;
    }
  }

  return ruleDef as GraphQLESLintRule;
}

// The engine only carries graphql-eslint's schema (SDL) rules. Some are mixed (like "alphabetize"),
// so we patch them to hide their operation configurations.
export const RELEVANT_RULES = Object.entries(rules).map(
  ([ruleName, rule]) =>
    [ruleName, patchRulesConfig(ruleName as RuleName, rule)] as [RuleName, GraphQLESLintRule],
);
