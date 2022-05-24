import { Injectable, Scope } from 'graphql-modules';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { Logger } from '../../shared/providers/logger';
import { CryptoProvider } from '../../shared/providers/crypto';
import { Storage, OrganizationSelector, ProjectSelector, TargetSelector } from '../../shared/providers/storage';
import { Tracking } from '../../shared/providers/tracking';
import { AccessError } from '../../../shared/errors';
import { IntegrationsAccessContext } from './integrations-access-context';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SlackIntegrationManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
    private tracking: Tracking,
    private crypto: CryptoProvider
  ) {
    this.logger = logger.child({
      source: 'SlackIntegrationManager',
    });
  }

  async register(
    input: OrganizationSelector & {
      token: string;
    }
  ): Promise<void> {
    this.logger.debug('Registering Slack integration (organization=%s)', input.organization);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });
    await this.tracking.track({
      event: 'ADDED_SLACK_INTEGRATION',
      data: {
        organization: input.organization,
      },
    });
    await this.storage.addSlackIntegration({
      organization: input.organization,
      token: this.crypto.encrypt(input.token),
    });
  }

  async unregister(input: OrganizationSelector): Promise<void> {
    this.logger.debug('Removing Slack integration (organization=%s)', input.organization);
    await this.authManager.ensureOrganizationAccess({
      ...input,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });
    await this.tracking.track({
      event: 'DELETED_SLACK_INTEGRATION',
      data: {
        organization: input.organization,
      },
    });
    await this.storage.deleteSlackIntegration({
      organization: input.organization,
    });
  }

  async isAvailable(selector: OrganizationSelector): Promise<boolean> {
    this.logger.debug('Checking Slack integration (organization=%s)', selector.organization);
    const token = await this.getToken({
      organization: selector.organization,
      context: IntegrationsAccessContext.Integrations,
    });

    return typeof token === 'string';
  }

  async getToken(
    selector: OrganizationSelector & {
      context: IntegrationsAccessContext.Integrations;
    }
  ): Promise<string | null | undefined>;
  async getToken(
    selector: ProjectSelector & {
      context: IntegrationsAccessContext.ChannelConfirmation;
    }
  ): Promise<string | null | undefined>;
  async getToken(
    selector: TargetSelector & {
      context: IntegrationsAccessContext.SchemaPublishing;
    }
  ): Promise<string | null | undefined>;
  async getToken(
    selector:
      | (OrganizationSelector & {
          context: IntegrationsAccessContext.Integrations;
        })
      | (ProjectSelector & {
          context: IntegrationsAccessContext.ChannelConfirmation;
        })
      | (TargetSelector & {
          context: IntegrationsAccessContext.SchemaPublishing;
        })
  ): Promise<string | null | undefined> {
    switch (selector.context) {
      case IntegrationsAccessContext.Integrations: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, context: %s)',
          selector.organization,
          selector.context
        );
        await this.authManager.ensureOrganizationAccess({
          ...selector,
          scope: OrganizationAccessScope.INTEGRATIONS,
        });
        break;
      }
      case IntegrationsAccessContext.ChannelConfirmation: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, project=%s, context: %s)',
          selector.organization,
          selector.project,
          selector.context
        );
        await this.authManager.ensureProjectAccess({
          ...selector,
          scope: ProjectAccessScope.ALERTS,
        });
        break;
      }
      case IntegrationsAccessContext.SchemaPublishing: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, project=%s, target=%s context: %s)',
          selector.organization,
          selector.project,
          selector.target,
          selector.context
        );
        await this.authManager.ensureTargetAccess({
          ...selector,
          scope: TargetAccessScope.REGISTRY_WRITE,
        });
        break;
      }
      default: {
        throw new AccessError('wrong context');
      }
    }

    let token = await this.storage.getSlackIntegrationToken({
      organization: selector.organization,
    });

    if (token) {
      /**
       * Token is possibly not encrypted, that's why we pass `true` as second argument.
       */
      token = this.crypto.decrypt(token, true);
    }

    return token;
  }
}
