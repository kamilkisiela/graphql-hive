import { Injectable, Scope } from 'graphql-modules';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
})
export class UserManager {
  private logger: Logger;

  constructor(logger: Logger, private storage: Storage) {
    this.logger = logger.child({
      source: 'UserManager',
    });
  }

  async createUser(input: { external: string; email: string }) {
    this.logger.info('Creating new user (input=%o)', input);
    const user = await this.storage.createUser(input);

    return user;
  }

  updateUser(input: { displayName: string; fullName: string; id: string }) {
    this.logger.info('Updating user (input=%o)', input);
    return this.storage.updateUser(input);
  }
}
