import { createHash } from 'crypto';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { paramCase } from 'param-case';
import { Organization, OrganizationInvitation } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { cache, diffArrays, pushIfMissing, share, uuid } from '../../../shared/helpers';
import { ActivityManager } from '../../activity/providers/activity-manager';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { BillingProvider } from '../../billing/providers/billing.provider';
import { Emails } from '../../shared/providers/emails';
import { Logger } from '../../shared/providers/logger';
import type { OrganizationSelector } from '../../shared/providers/storage';
import { Storage } from '../../shared/providers/storage';
import { WEB_APP_URL } from '../../shared/providers/tokens';
import { TokenStorage } from '../../token/providers/token-storage';
import { organizationAdminScopes, reservedOrganizationNames } from './organization-config';

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class OrganizationManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private authManager: AuthManager,
    private tokenStorage: TokenStorage,
    private activityManager: ActivityManager,
    private billingProvider: BillingProvider,
    private emails: Emails,
    @Inject(WEB_APP_URL) private appBaseUrl: string,
  ) {
    this.logger = logger.child({ source: 'OrganizationManager' });
  }

  getOrganizationFromToken: () => Promise<Organization | never> = share(async () => {
    const token = this.authManager.ensureApiToken();
    const result = await this.tokenStorage.getToken({ token });

    await this.authManager.ensureOrganizationAccess({
      organization: result.organization,
      scope: OrganizationAccessScope.READ,
    });

    return this.storage.getOrganization({
      organization: result.organization,
    });
  });

  getOrganizationIdByToken: () => Promise<string | never> = share(async () => {
    const token = this.authManager.ensureApiToken();
    const { organization } = await this.tokenStorage.getToken({
      token,
    });

    return organization;
  });

  async getOrganization(
    selector: OrganizationSelector,
    scope = OrganizationAccessScope.READ,
  ): Promise<Organization> {
    this.logger.debug('Fetching organization (selector=%o)', selector);
    await this.authManager.ensureOrganizationAccess({
      ...selector,
      scope,
    });
    return this.storage.getOrganization(selector);
  }

  async getOrganizations(): Promise<readonly Organization[]> {
    this.logger.debug('Fetching organizations');
    const user = await this.authManager.getCurrentUser();
    return this.storage.getOrganizations({ user: user.id });
  }

  async canLeaveOrganization({
    organizationId,
    userId,
  }: {
    organizationId: string;
    userId: string;
  }) {
    const member = await this.storage.getOrganizationMember({
      organization: organizationId,
      user: userId,
    });

    if (!member) {
      return {
        result: false,
        reason: 'Member not found',
      };
    }

    if (member.isOwner) {
      return {
        result: false,
        reason: 'Cannot leave organization as an owner',
      };
    }

    const membersCount = await this.countOrganizationMembers({
      organization: organizationId,
    });

    if (membersCount > 1) {
      return {
        result: true,
        reason: 'Organization has more than one member',
      };
    }

    return {
      result: false,
      reason: 'Cannot leave organization as the last member',
    };
  }

  async leaveOrganization(organizationId: string): Promise<
    | {
        ok: true;
      }
    | {
        ok: false;
        message: string;
      }
  > {
    this.logger.debug('Leaving organization (organization=%s)', organizationId);
    const user = await this.authManager.getCurrentUser();

    const canLeave = await this.canLeaveOrganization({
      organizationId,
      userId: user.id,
    });

    if (!canLeave.result) {
      return {
        ok: false,
        message: canLeave.reason,
      };
    }

    await this.storage.deleteOrganizationMembers({
      users: [user.id],
      organization: organizationId,
    });

    await this.activityManager.create({
      type: 'MEMBER_LEFT',
      selector: {
        organization: organizationId,
      },
      user: user,
      meta: {
        email: user.email,
      },
    });

    // Because we checked the access before, it's stale by now
    this.authManager.resetAccessCache();

    return {
      ok: true,
    };
  }

  async getOrganizationByInviteCode({
    code,
  }: {
    code: string;
  }): Promise<Organization | { message: string } | never> {
    this.logger.debug('Fetching organization (inviteCode=%s)', code);
    const organization = await this.storage.getOrganizationByInviteCode({
      inviteCode: code,
    });

    if (!organization) {
      return {
        message: 'Invitation expired',
      };
    }

    const hasAccess = await this.authManager.checkOrganizationAccess({
      organization: organization.id,
      scope: OrganizationAccessScope.READ,
    });

    if (hasAccess) {
      return {
        message: "You're already a member",
      };
    }

    return organization;
  }

  @cache((selector: OrganizationSelector) => selector.organization)
  async getOrganizationMembers(selector: OrganizationSelector) {
    return this.storage.getOrganizationMembers(selector);
  }

  countOrganizationMembers(selector: OrganizationSelector) {
    return this.storage.countOrganizationMembers(selector);
  }

  async getOrganizationMember(selector: OrganizationSelector & { user: string }) {
    const member = await this.storage.getOrganizationMember(selector);

    if (!member) {
      throw new HiveError('Member not found');
    }

    return member;
  }

  @cache((selector: OrganizationSelector) => selector.organization)
  async getInvitations(selector: OrganizationSelector) {
    await this.authManager.ensureOrganizationAccess({
      organization: selector.organization,
      scope: OrganizationAccessScope.MEMBERS,
    });
    return this.storage.getOrganizationInvitations(selector);
  }

  async getOrganizationOwner(selector: OrganizationSelector) {
    return this.storage.getOrganizationOwner(selector);
  }

  async createOrganization(input: {
    name: string;
    user: {
      id: string;
      superTokensUserId: string | null;
      oidcIntegrationId: string | null;
    };
  }): Promise<Organization> {
    const { name, user } = input;
    this.logger.info('Creating an organization (input=%o)', input);

    if (user.oidcIntegrationId) {
      this.logger.debug(
        'Failed to create organization as oidc user is not allowed to do so (input=%o)',
        input,
      );
      throw new HiveError('Cannot create organization with OIDC user.');
    }

    const organization = await this.storage.createOrganization({
      name,
      cleanId: paramCase(name),
      user: user.id,
      scopes: organizationAdminScopes,
      reservedNames: reservedOrganizationNames,
    });

    await this.activityManager.create({
      type: 'ORGANIZATION_CREATED',
      selector: {
        organization: organization.id,
      },
      user,
    });

    return organization;
  }

  async deleteOrganization(selector: OrganizationSelector): Promise<Organization> {
    this.logger.info('Deleting an organization (organization=%s)', selector.organization);
    await this.authManager.ensureOrganizationAccess({
      organization: selector.organization,
      scope: OrganizationAccessScope.DELETE,
    });

    const organization = await this.getOrganization({
      organization: selector.organization,
    });

    const deletedOrganization = await this.storage.deleteOrganization({
      organization: organization.id,
    });

    await this.tokenStorage.invalidateTokens(deletedOrganization.tokens);

    // Because we checked the access before, it's stale by now
    this.authManager.resetAccessCache();

    return deletedOrganization;
  }

  async updatePlan(
    input: {
      plan: string;
    } & OrganizationSelector,
  ): Promise<Organization> {
    const { plan } = input;
    this.logger.info('Updating an organization plan (input=%o)', input);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.SETTINGS,
    });
    const organization = await this.getOrganization({
      organization: input.organization,
    });

    const result = await this.storage.updateOrganizationPlan({
      billingPlan: plan,
      organization: organization.id,
    });

    await this.activityManager.create({
      type: 'ORGANIZATION_PLAN_UPDATED',
      selector: {
        organization: organization.id,
      },
      meta: {
        newPlan: plan,
        previousPlan: organization.billingPlan,
      },
    });

    return result;
  }

  async updateRateLimits(
    input: Pick<Organization, 'monthlyRateLimit'> & OrganizationSelector,
  ): Promise<Organization> {
    const { monthlyRateLimit } = input;
    this.logger.info('Updating an organization plan (input=%o)', input);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.SETTINGS,
    });
    const organization = await this.getOrganization({
      organization: input.organization,
    });

    const result = await this.storage.updateOrganizationRateLimits({
      monthlyRateLimit,
      organization: organization.id,
    });

    if (this.billingProvider.enabled) {
      await this.billingProvider.syncOrganization({
        organizationId: organization.id,
        reserved: {
          operations: Math.floor(input.monthlyRateLimit.operations / 1_000_000),
        },
      });
    }

    return result;
  }

  async updateName(
    input: {
      name: string;
    } & OrganizationSelector,
  ): Promise<Organization> {
    const { name } = input;
    this.logger.info('Updating an organization name (input=%o)', input);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.SETTINGS,
    });
    const [user, organization] = await Promise.all([
      this.authManager.getCurrentUser(),
      this.getOrganization({
        organization: input.organization,
      }),
    ]);

    let cleanId = paramCase(name);

    if (await this.storage.getOrganizationByCleanId({ cleanId })) {
      cleanId = paramCase(`${name}-${uuid(4)}`);
    }

    const result = await this.storage.updateOrganizationName({
      name,
      cleanId,
      organization: organization.id,
      user: user.id,
    });

    await this.activityManager.create({
      type: 'ORGANIZATION_NAME_UPDATED',
      selector: {
        organization: organization.id,
      },
      meta: {
        value: result.name,
      },
    });

    return result;
  }

  async deleteInvitation(input: { email: string; organization: string }) {
    await this.authManager.ensureOrganizationAccess({
      scope: OrganizationAccessScope.MEMBERS,
      organization: input.organization,
    });
    return this.storage.deleteOrganizationInvitationByEmail(input);
  }

  async inviteByEmail(input: {
    email: string;
    organization: string;
  }): Promise<OrganizationInvitation> {
    await this.authManager.ensureOrganizationAccess({
      scope: OrganizationAccessScope.MEMBERS,
      organization: input.organization,
    });

    const { email } = input;
    this.logger.info(
      'Inviting to the organization (email=%s, organization=%s)',
      email,
      input.organization,
    );
    const organization = await this.getOrganization({
      organization: input.organization,
    });

    const members = await this.getOrganizationMembers({ organization: input.organization });
    const existingMember = members.find(member => member.user.email === email);

    if (existingMember) {
      throw new HiveError(`User ${email} is already a member of the organization`);
    }

    // Delete existing invitation
    await this.storage.deleteOrganizationInvitationByEmail({
      organization: organization.id,
      email,
    });

    // create an invitation code (with 7d TTL)
    const invitation = await this.storage.createOrganizationInvitation({
      organization: organization.id,
      email,
    });

    await Promise.all([
      this.storage.completeGetStartedStep({
        organization: organization.id,
        step: 'invitingMembers',
      }),
      // schedule an email
      this.emails.schedule({
        id: JSON.stringify({
          id: 'org-invitation',
          organization: invitation.organization_id,
          code: createHash('sha256').update(invitation.code).digest('hex'),
          email: createHash('sha256').update(invitation.email).digest('hex'),
        }),
        email,
        body: `
          <mjml>
            <mj-body>
              <mj-section>
                <mj-column>
                  <mj-image width="150px" src="https://graphql-hive.com/logo.png"></mj-image>
                  <mj-divider border-color="#ca8a04"></mj-divider>
                  <mj-text>
                    Someone from <strong>${organization.name}</strong> invited you to join GraphQL Hive.
                  </mj-text>.
                  <mj-button href="${this.appBaseUrl}/join/${invitation.code}">
                    Accept the invitation
                  </mj-button>
                </mj-column>
              </mj-section>
            </mj-body>
          </mjml>
        `,
        subject: `You have been invited to join ${organization.name}`,
      }),
    ]);

    return invitation;
  }

  async joinOrganization({ code }: { code: string }): Promise<Organization | { message: string }> {
    this.logger.info('Joining an organization (code=%s)', code);

    const user = await this.authManager.getCurrentUser();

    if (user.oidcIntegrationId !== null) {
      return {
        message: `You cannot join an organization with an OIDC account.`,
      };
    }

    const organization = await this.getOrganizationByInviteCode({
      code,
    });

    if ('message' in organization) {
      return organization;
    }

    await this.storage.addOrganizationMemberViaInvitationCode({
      code,
      user: user.id,
      organization: organization.id,
      scopes: [
        OrganizationAccessScope.READ,
        ProjectAccessScope.READ,
        ProjectAccessScope.OPERATIONS_STORE_READ,
        TargetAccessScope.READ,
        TargetAccessScope.REGISTRY_READ,
      ],
    });

    // Because we checked the access before, it's stale by now
    this.authManager.resetAccessCache();

    await Promise.all([
      this.storage.completeGetStartedStep({
        organization: organization.id,
        step: 'invitingMembers',
      }),
      this.activityManager.create({
        type: 'MEMBER_ADDED',
        selector: {
          organization: organization.id,
          user: user.id,
        },
      }),
    ]);

    return organization;
  }

  async requestOwnershipTransfer(
    selector: {
      user: string;
    } & OrganizationSelector,
  ) {
    const currentUser = await this.authManager.getCurrentUser();

    if (currentUser.id === selector.user) {
      return {
        error: {
          message: 'Cannot transfer ownership to yourself',
        },
      };
    }

    await this.authManager.ensureOrganizationOwnership({
      organization: selector.organization,
    });

    const member = await this.storage.getOrganizationMember(selector);

    if (!member) {
      return {
        error: {
          message: 'Member not found',
        },
      };
    }

    const organization = await this.getOrganization(selector);

    const { code } = await this.storage.createOrganizationTransferRequest({
      organization: organization.id,
      user: member.id,
    });

    await this.emails.schedule({
      email: member.user.email,
      subject: `Organization transfer from ${currentUser.displayName} (${organization.name})`,
      body: `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-image width="150px" src="https://graphql-hive.com/logo.png"></mj-image>
                <mj-divider border-color="#ca8a04"></mj-divider>
                <mj-text>
                  ${member.user.displayName} wants to transfer the ownership of the <strong>${organization.name}</strong> organization.
                </mj-text>
                <mj-button href="https://app.graphql-hive.com/action/transfer/${organization.cleanId}/${code}">
                  Accept the transfer
                </mj-button>
                <mj-text align="center">
                  This link will expire in a day.
                </mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `,
    });

    return {
      ok: {
        email: member.user.email,
        code,
      },
    };
  }

  async getOwnershipTransferRequest(
    selector: {
      code: string;
    } & OrganizationSelector,
  ) {
    await this.authManager.ensureOrganizationAccess({
      organization: selector.organization,
      scope: OrganizationAccessScope.READ,
    });
    const currentUser = await this.authManager.getCurrentUser();

    return this.storage.getOrganizationTransferRequest({
      organization: selector.organization,
      code: selector.code,
      user: currentUser.id,
    });
  }

  async answerOwnershipTransferRequest(
    input: {
      code: string;
      accept: boolean;
    } & OrganizationSelector,
  ) {
    await this.authManager.ensureOrganizationAccess({
      organization: input.organization,
      scope: OrganizationAccessScope.READ,
    });
    const currentUser = await this.authManager.getCurrentUser();

    await this.storage.answerOrganizationTransferRequest({
      organization: input.organization,
      code: input.code,
      user: currentUser.id,
      accept: input.accept,
      oldAdminAccessScopes:
        // pass every scope except *.DELETE
        organizationAdminScopes.filter(
          scope =>
            [
              OrganizationAccessScope.DELETE,
              ProjectAccessScope.DELETE,
              TargetAccessScope.DELETE,
            ].includes(scope) === false,
        ),
    });
  }

  async deleteMembers(
    selector: {
      users: readonly string[];
    } & OrganizationSelector,
  ): Promise<Organization> {
    this.logger.info('Deleting a member from an organization (selector=%o)', selector);
    await this.authManager.ensureOrganizationAccess({
      ...selector,
      scope: OrganizationAccessScope.MEMBERS,
    });
    const owner = await this.getOrganizationOwner(selector);
    const { users, organization } = selector;

    if (users.includes(owner.id)) {
      throw new HiveError(`Cannot remove the owner from the organization`);
    }

    const members = await this.storage.getOrganizationMembers({
      organization,
    });

    await this.storage.deleteOrganizationMembers({
      users,
      organization,
    });

    await Promise.all(
      users.map(user => {
        const member = members.find(m => m.id === user);

        if (member) {
          return this.activityManager.create({
            type: 'MEMBER_DELETED',
            selector: {
              organization,
            },
            meta: {
              email: member.user.email,
            },
          });
        }
      }),
    );

    // Because we checked the access before, it's stale by now
    this.authManager.resetAccessCache();

    return this.storage.getOrganization({
      organization,
    });
  }

  async updateMemberAccess(
    input: {
      user: string;
      organizationScopes: readonly OrganizationAccessScope[];
      projectScopes: readonly ProjectAccessScope[];
      targetScopes: readonly TargetAccessScope[];
    } & OrganizationSelector,
  ) {
    this.logger.info('Updating a member access in an organization (input=%o)', input);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.MEMBERS,
    });

    const currentUser = await this.authManager.getCurrentUser();

    const [currentMember, member] = await Promise.all([
      this.getOrganizationMember({
        organization: input.organization,
        user: currentUser.id,
      }),
      this.getOrganizationMember({
        organization: input.organization,
        user: input.user,
      }),
    ]);

    const newScopes = [...input.organizationScopes, ...input.projectScopes, ...input.targetScopes];

    // See what scopes were removed or added
    const modifiedScopes = diffArrays(member.scopes, newScopes);

    // Check if the current user has rights to update these member scopes
    // User can't manage other user's scope if he's missing the scope as well
    const currentUserMissingScopes = modifiedScopes.filter(
      scope => !currentMember.scopes.includes(scope),
    );

    if (currentUserMissingScopes.length > 0) {
      this.logger.debug(`Logged user scopes: %o`, currentMember.scopes);
      throw new HiveError(`No access to modify the scopes: ${currentUserMissingScopes.join(', ')}`);
    }

    // Ensure user still has read-only access
    pushIfMissing(newScopes, TargetAccessScope.READ);
    pushIfMissing(newScopes, ProjectAccessScope.READ);
    pushIfMissing(newScopes, OrganizationAccessScope.READ);

    // Update the scopes
    await this.storage.updateOrganizationMemberAccess({
      organization: input.organization,
      user: input.user,
      scopes: newScopes,
    });

    // Because we checked the access before, it's stale by now
    this.authManager.resetAccessCache();

    return this.storage.getOrganization({
      organization: input.organization,
    });
  }
}
