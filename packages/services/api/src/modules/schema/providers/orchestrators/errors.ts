import { SchemaCompositionError } from 'packages/services/api/src/shared/entities';
import { HiveError } from '../../../../shared/errors';

export class SchemaBuildError extends HiveError {
  errors: ReadonlyArray<SchemaCompositionError>;
  constructor(message: string, errors: ReadonlyArray<SchemaCompositionError>) {
    super(message);
    this.errors = errors;
  }
}
