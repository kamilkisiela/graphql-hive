import { Injectable, Scope } from 'graphql-modules';
import type { Token } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { diffArrays, pushIfMissing } from '../../../shared/helpers';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { Logger } from '../../shared/providers/logger';
import { Storage, TargetSelector } from '../../shared/providers/storage';
import type { CreateTokenResult } from './token-storage';
import { TokenStorage } from './token-storage';

interface CreateTokenInput extends TargetSelector {
  name: string;
  organizationScopes: readonly OrganizationAccessScope[];
  projectScopes: readonly ProjectAccessScope[];
  targetScopes: readonly TargetAccessScope[];
}

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TokenManager {
  private logger: Logger;

  constructor(
    private authManager: AuthManager,
    private tokenStorage: TokenStorage,
    private storage: Storage,
    logger: Logger,
  ) {
    this.logger = logger.child({
      source: 'TokenManager',
    });
  }

  async createToken(input: CreateTokenInput): Promise<CreateTokenResult> {
    await this.authManager.ensureTargetAccess({
      project: input.project,
      organization: input.organization,
      target: input.target,
      scope: TargetAccessScope.TOKENS_WRITE,
    });

    const scopes = [...input.organizationScopes, ...input.projectScopes, ...input.targetScopes];

    const currentUser = await this.authManager.getCurrentUser();
    const currentMember = await this.storage.getOrganizationMember({
      organization: input.organization,
      user: currentUser.id,
    });

    if (!currentMember) {
      throw new HiveError('User is not a member of the organization');
    }

    const newScopes = [...input.organizationScopes, ...input.projectScopes, ...input.targetScopes];

    // See what scopes were removed or added
    const modifiedScopes = diffArrays(currentMember.scopes, newScopes);

    // Check if the current user has rights to set these scopes.
    const currentUserMissingScopes = modifiedScopes.filter(
      scope => !currentMember.scopes.includes(scope),
    );

    if (currentUserMissingScopes.length > 0) {
      this.logger.debug(`Logged user scopes: %o`, currentMember.scopes);
      throw new HiveError(`No access to the scopes: ${currentUserMissingScopes.join(', ')}`);
    }

    pushIfMissing(scopes, TargetAccessScope.READ);
    pushIfMissing(scopes, ProjectAccessScope.READ);
    pushIfMissing(scopes, OrganizationAccessScope.READ);

    return this.tokenStorage.createToken({
      organization: input.organization,
      project: input.project,
      target: input.target,
      name: input.name,
      scopes,
    });
  }

  async deleteTokens(
    input: {
      tokens: readonly string[];
    } & TargetSelector,
  ): Promise<readonly string[]> {
    await this.authManager.ensureTargetAccess({
      project: input.project,
      organization: input.organization,
      target: input.target,
      scope: TargetAccessScope.TOKENS_WRITE,
    });

    return this.tokenStorage.deleteTokens(input);
  }

  async getTokens(selector: TargetSelector): Promise<readonly Token[]> {
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.TOKENS_READ,
    });
    return this.tokenStorage.getTokens(selector);
  }

  async getCurrentToken(): Promise<Token> {
    const token = this.authManager.ensureApiToken();
    return this.tokenStorage.getToken({ token });
  }
}
