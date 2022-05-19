import { rules } from '@graphql-eslint/eslint-plugin';
import { Linter } from 'eslint';

export type SchemaCheckInput = {
  source: string;
  policy: Policy;
};

export interface BuildOutput {
  errors: any[];
  warnings: any[];
  info: any[];
}

export type Policy = {
  [K in keyof typeof rules]: Linter.RuleEntry;
};
