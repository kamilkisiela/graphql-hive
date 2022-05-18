import { HiveError } from '../../../../shared/errors';

export class SchemaBuildError extends HiveError {
  constructor(error: Error) {
    super(`Failed to build schema: ${error.message}`, {});
    Object.assign(this, { originalError: error });
  }
}
