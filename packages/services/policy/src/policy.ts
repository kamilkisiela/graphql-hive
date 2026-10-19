import Ajv from 'ajv';
import { z, ZodType } from 'zod';
import { lint } from './engine/linter';
import { rules } from './engine/rules';
import type { GraphQLESLintRule } from './engine/types';
import { RELEVANT_RULES } from './rules';

const ajv = new Ajv({
  meta: false,
  useDefaults: true,
  validateSchema: false,
  verbose: true,
  allowMatchingProperties: true,
});

const RULE_LEVEL = z.union([z.number().min(0).max(2), z.enum(['off', 'warn', 'error'])]);

type RulemapValidationType = {
  [_RuleKey in keyof typeof rules]: ZodType;
};

export function normalizeAjvSchema(
  schema: GraphQLESLintRule['meta']['schema'],
): GraphQLESLintRule['meta']['schema'] | null {
  if (Array.isArray(schema)) {
    if (schema.length === 0) {
      return null;
    }

    return {
      type: 'array',
      items: schema,
      minItems: 0,
      maxItems: schema.length,
    };
  }

  return schema || null;
}

export function createInputValidationSchema() {
  return z
    .object(
      RELEVANT_RULES.reduce((acc, [name, rule]) => {
        const schema = normalizeAjvSchema(rule.meta.schema);
        const validate = schema ? ajv.compile(schema) : null;

        return {
          ...acc,
          [name]: z.union([
            z.tuple([RULE_LEVEL]),
            z.tuple(
              validate
                ? [
                    RULE_LEVEL,
                    z.custom(data => {
                      const asArray = (Array.isArray(data) ? data : [data]).filter(Boolean);
                      const result = validate(asArray);

                      if (result) {
                        return true;
                      }

                      throw new Error(
                        `Failed to validate rule "${name}" configuration: ${ajv.errorsText(
                          validate.errors,
                        )}`,
                      );
                    }),
                  ]
                : [RULE_LEVEL],
            ),
          ]),
        };
      }, {} as RulemapValidationType),
    )
    .required()
    .partial()
    .strict('Unknown rule name passed');
}

export type PolicyConfigurationObject = z.infer<ReturnType<typeof createInputValidationSchema>>;

export async function schemaPolicyCheck(input: {
  source: string;
  schema: string;
  policy: PolicyConfigurationObject;
}) {
  return lint({ source: input.source, schema: input.schema, rules: input.policy });
}
