import { Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';

export const displayNameLengthBoundaries = {
  min: 2,
  max: 25,
} as const;

export const fullNameLengthBoundaries = {
  min: 2,
  max: 25,
} as const;

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
})
export class UserManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
  ) {
    this.logger = logger.child({
      source: 'UserManager',
    });
  }

  updateUser(input: { displayName: string; fullName: string; id: string }) {
    this.logger.info('Updating user (input=%o)', input);
    return this.storage.updateUser(input);
  }
}
