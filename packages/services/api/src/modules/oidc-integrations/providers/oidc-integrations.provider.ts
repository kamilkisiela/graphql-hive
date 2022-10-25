import { Inject, Injectable, Scope } from 'graphql-modules';
import { OIDCIntegration, OrganizationType } from '../../../shared/entities';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { CryptoProvider } from '../../shared/providers/crypto';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { OIDC_INTEGRATIONS_ENABLED } from './tokens';
import zod from 'zod';

@Injectable({
  global: true,
  scope: Scope.Operation,
})
export class OIDCIntegrationsProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private authManager: AuthManager,
    private crypto: CryptoProvider,
    @Inject(OIDC_INTEGRATIONS_ENABLED) private enabled: boolean
  ) {
    this.logger = logger.child({ source: 'OIDCIntegrationsProvider' });
  }

  isEnabled() {
    return this.enabled;
  }

  async canViewerManageIntegrationForOrganization(args: {
    organizationId: string;
    organizationType: OrganizationType;
  }) {
    if (this.isEnabled() === false || args.organizationType === OrganizationType.PERSONAL) {
      return false;
    }

    try {
      await this.authManager.ensureOrganizationAccess({
        organization: args.organizationId,
        scope: OrganizationAccessScope.INTEGRATIONS,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getOIDCIntegrationForOrganization(args: { organizationId: string }): Promise<OIDCIntegration | null> {
    this.logger.debug('getting okta integration for organization (organizationId=%s)', args.organizationId);
    if (this.isEnabled() === false) {
      this.logger.debug('okta integrations are disabled.');
      return null;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: args.organizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    return await this.storage.getOIDCIntegrationForOrganization({ organizationId: args.organizationId });
  }

  async getClientSecretPreview(integration: OIDCIntegration) {
    const decryptedSecret = this.crypto.decrypt(integration.encryptedClientSecret);
    return decryptedSecret.substring(decryptedSecret.length - 4);
  }

  async createOIDCIntegrationForOrganization(args: {
    organizationId: string;
    clientId: string;
    clientSecret: string;
    domain: string;
  }) {
    if (this.isEnabled() === false) {
      return {
        type: 'error',
        message: 'OIDC integrations are disabled.',
      } as const;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: args.organizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    const organization = await this.storage.getOrganization({ organization: args.organizationId });

    if (organization.type === OrganizationType.PERSONAL) {
      return {
        type: 'error',
        message: 'Personal organizations cannot have OIDC integrations.',
      } as const;
    }

    const clientIdResult = OIDCIntegrationClientIdModel.safeParse(args.clientId);
    const clientSecretResult = OIDCClientSecretModel.safeParse(args.clientSecret);
    const domainResult = OIDCDomainModel.safeParse(args.domain);

    if (clientIdResult.success && clientSecretResult.success && domainResult.success) {
      const oidcIntegration = await this.storage.createOIDCIntegrationForOrganization({
        organizationId: args.organizationId,
        clientId: clientIdResult.data,
        encryptedClientSecret: this.crypto.encrypt(clientSecretResult.data),
        domain: domainResult.data,
      });

      return {
        type: 'ok',
        oidcIntegration,
      } as const;
    }

    return {
      type: 'error',
      fieldErrors: {
        clientId: clientIdResult.success ? null : clientIdResult.error.issues[0].message,
        clientSecret: clientSecretResult.success ? null : clientSecretResult.error.issues[0].message,
        domain: domainResult.success ? null : domainResult.error.issues[0].message,
      },
    } as const;
  }

  async updateOIDCIntegration(args: {
    oidcIntegrationId: string;
    clientId: string | null;
    clientSecret: string | null;
    domain: string | null;
  }) {
    if (this.isEnabled() === false) {
      return {
        type: 'error',
        message: 'OIDC integrations are disabled.',
      } as const;
    }

    const integration = await this.storage.getOIDCIntegrationById({ oidcIntegrationId: args.oidcIntegrationId });

    if (integration === null) {
      return {
        type: 'error',
        message: 'Integration not found.',
        fieldErrors: {
          clientId: null,
          clientSecret: null,
          domain: null,
        },
      } as const;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: integration.linkedOrganizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    const clientIdResult = maybe(OIDCIntegrationClientIdModel).safeParse(args.clientId);
    const clientSecretResult = maybe(OIDCClientSecretModel).safeParse(args.clientSecret);
    const domainResult = maybe(OIDCDomainModel).safeParse(args.domain);

    if (clientIdResult.success && clientSecretResult.success && domainResult.success) {
      const oidcIntegration = await this.storage.updateOIDCIntegration({
        oidcIntegrationId: args.oidcIntegrationId,
        clientId: clientIdResult.data,
        encryptedClientSecret: clientSecretResult.data ? this.crypto.encrypt(clientSecretResult.data) : null,
        domain: domainResult.data,
      });

      return {
        type: 'ok',
        oidcIntegration,
      } as const;
    }

    return {
      type: 'error',
      message: "Couldn't update integration.",
      fieldErrors: {
        clientId: clientIdResult.success ? null : clientIdResult.error.issues[0].message,
        clientSecret: clientSecretResult.success ? null : clientSecretResult.error.issues[0].message,
        domain: domainResult.success ? null : domainResult.error.issues[0].message,
      },
    } as const;
  }

  async deleteOIDCIntegration(args: { oidcIntegrationId: string }) {
    if (this.isEnabled() === false) {
      return {
        type: 'error',
        message: 'OIDC integrations are disabled.',
      } as const;
    }

    const integration = await this.storage.getOIDCIntegrationById({ oidcIntegrationId: args.oidcIntegrationId });

    if (integration === null) {
      return {
        type: 'error',
        message: 'Integration not found.',
      } as const;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: integration.linkedOrganizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    await this.storage.deleteOIDCIntegration(args);

    return {
      type: 'ok',
      organizationId: integration.linkedOrganizationId,
    } as const;
  }
}

const OIDCIntegrationClientIdModel = zod
  .string()
  .min(3, 'Must be at least 3 characters long.')
  .max(100, 'Can not be longer than 100 characters.');

const OIDCClientSecretModel = zod
  .string()
  .min(3, 'Must be at least 3 characters long.')
  .max(200, 'Can not be longer than 200 characters.');

const OIDCDomainModel = zod.string().url('Must be a valid domain.');

const maybe = <TSchema>(schema: zod.ZodSchema<TSchema>) => zod.union([schema, zod.null()]);
