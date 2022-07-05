import { Injectable, Scope } from 'graphql-modules';
import { Orchestrator, Schema, SchemaObject } from '../../../shared/entities';
import { buildSchema, findSchema, hashSchema } from '../../../shared/schema';
import * as Types from '../../../__generated__/types';
import { Logger } from '../../shared/providers/logger';
import { sentry } from '../../../shared/sentry';
import { SchemaHelper } from './schema-helper';
import { Inspector } from './inspector';

export type ValidationResult = {
  valid: boolean;
  errors: Array<Types.SchemaError>;
  changes: Array<Types.SchemaChange>;
};

@Injectable({
  scope: Scope.Operation,
})
export class SchemaValidator {
  private logger: Logger;

  constructor(logger: Logger, private inspector: Inspector, private helper: SchemaHelper) {
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
  }): Promise<ValidationResult> {
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
    const afterSchemasWithBase: SchemaObject[] = afterWithBase.map(s => this.helper.createSchemaObject(s));
    const afterSchemas: SchemaObject[] = after.map(s => this.helper.createSchemaObject(s));
    const beforeSchemas: SchemaObject[] = before.map(s => this.helper.createSchemaObject(s));

    const isInitialSchema = beforeSchemas.length === 0;
    const areIdentical = existing && hashSchema(existing) === hashSchema(incoming);

    if (areIdentical) {
      return {
        valid: true,
        errors: [],
        changes: [],
      };
    }

    const errors = await orchestrator.validate(afterSchemasWithBase);

    if (isInitialSchema) {
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
