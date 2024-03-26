import { GraphQLError } from 'graphql';
import type { SchemaError } from '../__generated__/types';

export function toSchemaError(error: unknown): SchemaError {
  if (isGraphQLError(error)) {
    return {
      message: error.message,
      path: error.path?.map(i => (typeof i === 'number' ? String(i) : i)),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: error as string,
  };
}

export function isGraphQLError(error: unknown): error is GraphQLError {
  return error instanceof GraphQLError;
}

export const HiveError = GraphQLError;

export class AccessError extends HiveError {
  constructor(reason: string, code: string = 'UNAUTHORISED') {
    super(`No access (reason: "${reason}")`, {
      extensions: {
        code,
      },
    });
  }
}
