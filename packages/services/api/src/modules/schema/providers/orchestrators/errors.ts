import type { SchemaCompositionError } from '@hive/storage';
import { HiveError } from '../../../../shared/errors';

export class SchemaBuildError extends HiveError {
  errors: ReadonlyArray<SchemaCompositionError>;
  constructor(message: string, errors: ReadonlyArray<SchemaCompositionError>) {
    super(message);
    this.errors = errors;
  }
}
