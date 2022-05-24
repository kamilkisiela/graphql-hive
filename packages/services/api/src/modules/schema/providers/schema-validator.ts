import { Injectable, Scope } from 'graphql-modules';
import { createSchemaObject, Orchestrator, Schema, SchemaObject } from '../../../shared/entities';
import { buildSchema, findSchema, hashSchema } from '../../../shared/schema';
import * as Types from '../../../__generated__/types';
import { Logger } from '../../shared/providers/logger';
import { sentry } from '../../../shared/sentry';
import { Inspector } from './inspector';

@Injectable({
  scope: Scope.Operation,
})
export class SchemaValidator {
  private logger: Logger;

  constructor(logger: Logger, private inspector: Inspector) {
    this.logger = logger.child({ service: 'SchemaValidator' });
  }

  @sentry('SchemaValidator.validate')
  async validate({
    orchestrator,
    selector,
    incoming,
    before,
    after,
    baseSchema,
  }: {
    orchestrator: Orchestrator;
    incoming: Schema;
    before: readonly Schema[];
    after: readonly Schema[];
    selector: Types.TargetSelector;
    baseSchema: string | null;
  }) {
    this.logger.debug('Validating Schema');
    const existing = findSchema(before, incoming);
    const afterWithBase = after.map((schema, index) => {
      let source = '';
      if (index === 0) {
        source = (baseSchema || '') + schema.source;
      } else {
        source = schema.source;
      }
      return {
        id: schema.id,
        author: schema.author,
        source: source,
        date: schema.date,
        commit: schema.commit,
        url: schema.url,
        service: schema.service,
        target: schema.target,
      };
    });
    const afterSchemasWithBase: SchemaObject[] = afterWithBase.map(createSchemaObject);
    const afterSchemas: SchemaObject[] = after.map(createSchemaObject);
    const beforeSchemas: SchemaObject[] = before.map(createSchemaObject);

    const isInitialSchema = beforeSchemas.length === 0;
    const isIdentical = existing && hashSchema(existing) === hashSchema(incoming);

    if (isIdentical) {
      return {
        valid: true,
        errors: [],
        changes: [],
      };
    }

    const errors = await orchestrator.validate(afterSchemasWithBase);

    if (isInitialSchema) {
      if (errors.length > 0) {
        errors.push({
          message: `Note: If this is your first schema publish, please make sure it's fully valid and standalone.`,
        });
      }

      return {
        valid: errors.length === 0,
        errors: errors,
        changes: [],
      };
    }

    let changes: Types.SchemaChange[] = [];

    try {
      const [existingSchema, incomingSchema] = await Promise.all([
        orchestrator.build(beforeSchemas),
        orchestrator.build(afterSchemas),
      ]);
      if (existingSchema) {
        changes = await this.inspector.diff(buildSchema(existingSchema), buildSchema(incomingSchema), selector);

        changes.forEach(change => {
          if (change.criticality === 'Breaking') {
            errors.push({
              message: `Breaking Change: ${change.message}`,
              path: change.path,
            });
          }
        });
      }
    } catch (error) {
      errors.push({
        message: `Failed to compare schemas: ${(error as Error).message}`,
      });
    }

    const hasErrors = errors.length > 0;
    const hasBreakingChanges = changes.some(change => change.criticality === 'Breaking');
    const valid = !hasErrors && !hasBreakingChanges;

    return {
      valid,
      errors,
      changes,
    };
  }
}
