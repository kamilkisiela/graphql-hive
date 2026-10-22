import { Injectable, Scope } from 'graphql-modules';
import { Encryptor } from '@hive/service-common';
import { AccessError } from '../../../shared/errors';
import { AuditLogRecorder } from '../../audit-logs/providers/audit-log-recorder';
import { Session } from '../../auth/lib/authz';
import { Logger } from '../../shared/providers/logger';
import {
  OrganizationSelector,
  ProjectSelector,
  Storage,
  TargetSelector,
} from '../../shared/providers/storage';
import { IntegrationsAccessContext } from './integrations-access-context';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SlackIntegrationManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private session: Session,
    private storage: Storage,
    private crypto: Encryptor,
    private auditLog: AuditLogRecorder,
  ) {
    this.logger = logger.child({
      source: 'SlackIntegrationManager',
    });
  }

  assertCanModify(selector: OrganizationSelector) {
    return this.session.assertPerformAction({
      action: 'slackIntegration:modify',
      organizationId: selector.organizationId,
      params: { organizationId: selector.organizationId },
    });
  }

  async register(
    input: OrganizationSelector & {
      token: string;
    },
  ): Promise<void> {
    this.logger.debug('Registering Slack integration (organization=%s)', input.organizationId);
    await this.assertCanModify(input);
    this.logger.debug('Updating organization');
    const result = await this.storage.addSlackIntegration({
      organizationId: input.organizationId,
      token: this.crypto.encrypt(input.token),
    });

    await this.auditLog.record({
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationId: input.organizationId,
      metadata: {
        integrationId: input.organizationId,
        integrationType: 'SLACK',
        integrationStatus: 'ENABLED',
      },
    });

    return result;
  }

  async unregister(input: OrganizationSelector): Promise<void> {
    this.logger.debug('Removing Slack integration (organization=%s)', input.organizationId);
    await this.session.assertPerformAction({
      action: 'slackIntegration:modify',
      organizationId: input.organizationId,
      params: {
        organizationId: input.organizationId,
      },
    });
    this.logger.debug('Updating organization');
    const result = await this.storage.deleteSlackIntegration({
      organizationId: input.organizationId,
    });

    await this.auditLog.record({
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationId: input.organizationId,
      metadata: {
        integrationId: input.organizationId,
        integrationType: 'GITHUB',
        integrationStatus: 'DISABLED',
      },
    });

    return result;
  }

  async isAvailable(selector: OrganizationSelector): Promise<boolean> {
    this.logger.debug('Checking Slack integration (organization=%s)', selector.organizationId);
    const token = await this.getToken({
      organizationId: selector.organizationId,
      context: IntegrationsAccessContext.Integrations,
    });

    return typeof token === 'string';
  }

  async getToken(
    selector: OrganizationSelector & {
      context: IntegrationsAccessContext.Integrations;
    },
  ): Promise<string | null | undefined>;
  async getToken(
    selector: ProjectSelector & {
      context: IntegrationsAccessContext.ChannelConfirmation;
    },
  ): Promise<string | null | undefined>;
  async getToken(
    selector: TargetSelector & {
      context: IntegrationsAccessContext.SchemaPublishing;
    },
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
        }),
  ): Promise<string | null | undefined> {
    switch (selector.context) {
      case IntegrationsAccessContext.Integrations: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, context: %s)',
          selector.organizationId,
          selector.context,
        );
        break;
      }
      case IntegrationsAccessContext.ChannelConfirmation: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, project=%s, context: %s)',
          selector.organizationId,
          selector.projectId,
          selector.context,
        );
        await this.session.assertPerformAction({
          action: 'alert:modify',
          organizationId: selector.organizationId,
          params: {
            organizationId: selector.organizationId,
            projectId: selector.projectId,
          },
        });
        break;
      }
      case IntegrationsAccessContext.SchemaPublishing: {
        this.logger.debug(
          'Fetching Slack integration token (organization=%s, project=%s, target=%s context: %s)',
          selector.organizationId,
          selector.projectId,
          selector.targetId,
          selector.context,
        );
        await this.session.assertPerformAction({
          action: 'schemaVersion:publish',
          organizationId: selector.organizationId,
          params: {
            organizationId: selector.organizationId,
            projectId: selector.projectId,
            targetId: selector.targetId,
            serviceName: null,
          },
        });
        break;
      }
      default: {
        throw new AccessError('wrong context');
      }
    }

    let token = await this.storage.getSlackIntegrationToken({
      organizationId: selector.organizationId,
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
