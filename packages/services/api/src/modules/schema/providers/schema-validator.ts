import { Injectable, Scope } from 'graphql-modules';
import * as Types from '../../../__generated__/types';
import { Orchestrator, Project, Schema, SchemaObject } from '../../../shared/entities';
import { buildSchema, findSchema, hashSchema } from '../../../shared/schema';
import { sentry } from '../../../shared/sentry';
import { Logger } from '../../shared/providers/logger';
import { Inspector } from './inspector';
import { SchemaBuildError } from './orchestrators/errors';
import { SchemaHelper } from './schema-helper';

export type ValidationResult = {
  valid: boolean;
  errors: Types.SchemaError[];
  changes: Types.SchemaChange[];
  messages: string[];
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
    beforeState,
    baseSchema,
    experimental_acceptBreakingChanges,
    project,
  }: {
    orchestrator: Orchestrator;
    incoming: Schema;
    before: readonly Schema[];
    after: readonly Schema[];
    beforeState: 'valid' | 'invalid' | null;
    selector: Types.TargetSelector;
    baseSchema: string | null;
    experimental_acceptBreakingChanges: boolean;
    project: Project;
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
        source,
        date: schema.date,
        commit: schema.commit,
        url: schema.url,
        service: schema.service,
        target: schema.target,
      };
    });
    const afterSchemasWithBase: SchemaObject[] = afterWithBase.map(s =>
      this.helper.createSchemaObject(s),
    );
    const afterSchemas: SchemaObject[] = after.map(s => this.helper.createSchemaObject(s));

    const isInitialSchema = before.length === 0;
    const areIdentical = existing && hashSchema(existing) === hashSchema(incoming);

    if (areIdentical) {
      return {
        valid: true,
        errors: [],
        changes: [],
        messages: [],
      };
    }

    const errors = await orchestrator.validate(
      afterSchemasWithBase,
      project.externalComposition.enabled ? project.externalComposition : null,
    );

    if (isInitialSchema) {
      return {
        valid: errors.length === 0,
        errors,
        changes: [],
        messages: [],
      };
    }

    let changes: Types.SchemaChange[] = [];
    const messages: string[] = [];

    const beforeSchemas: SchemaObject[] = before.map(s => this.helper.createSchemaObject(s));

    try {
      const [existingSchema, incomingSchema] = await Promise.all([
        orchestrator.build(beforeSchemas, project.externalComposition).catch(async error => {
          if (
            beforeState === 'invalid' &&
            error instanceof SchemaBuildError &&
            experimental_acceptBreakingChanges
          ) {
            this.logger.debug(
              'Failed to build previous schema, but the experimental_acceptBreakingChanges is enabled. Skipping breaking changes check.',
            );
            messages.push('Failed to build previous schema. Skipping changes check.');
            return null;
          }

          throw error;
        }),
        orchestrator.build(afterSchemas, project.externalComposition),
      ]);

      if (existingSchema) {
        changes = await this.inspector.diff(
          buildSchema(existingSchema),
          buildSchema(incomingSchema),
          selector,
        );

        const hasBreakingChanges = changes.some(change => change.criticality === 'Breaking');

        if (hasBreakingChanges) {
          if (experimental_acceptBreakingChanges) {
            this.logger.debug(
              'Schema contains breaking changes, but the experimental safe mode is enabled',
            );
          } else {
            changes.forEach(change => {
              if (change.criticality === 'Breaking') {
                errors.push({
                  message: `Breaking Change: ${change.message}`,
                  path: change.path,
                });
              }
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        message: `Failed to compare schemas: ${(error as Error).message}`,
      });
    }

    const hasErrors = errors.length > 0; // no errors means no breaking changes
    const valid = !hasErrors;

    return {
      valid,
      errors,
      changes,
      messages,
    };
  }
}
