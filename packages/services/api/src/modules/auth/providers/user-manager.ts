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

function buildUserCreatePayloadFromInput(input: { superTokensUserId: string; email: string }) {
  const displayName = input.email
    .split('@')[0]
    .slice(0, displayNameLengthBoundaries.max)
    .padEnd(displayNameLengthBoundaries.min, '1');
  const fullName = input.email
    .split('@')[0]
    .slice(0, fullNameLengthBoundaries.max)
    .padEnd(fullNameLengthBoundaries.min, '1');

  return {
    superTokensUserId: input.superTokensUserId,
    email: input.email,
    displayName,
    fullName,
  };
}

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

  async createUser(input: { superTokensUserId: string; email: string }) {
    this.logger.info('Creating new user (input=%o)', input);
    const user = await this.storage.createUser(buildUserCreatePayloadFromInput(input));

    return user;
  }

  updateUser(input: { displayName: string; fullName: string; id: string }) {
    this.logger.info('Updating user (input=%o)', input);
    return this.storage.updateUser(input);
  }
}
