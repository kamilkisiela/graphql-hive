import { Inject, Injectable, Scope } from 'graphql-modules';
import zod from 'zod';
import { OIDCIntegration } from '../../../shared/entities';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { CryptoProvider } from '../../shared/providers/crypto';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { OIDC_INTEGRATIONS_ENABLED } from './tokens';

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
    @Inject(OIDC_INTEGRATIONS_ENABLED) private enabled: boolean,
  ) {
    this.logger = logger.child({ source: 'OIDCIntegrationsProvider' });
  }

  isEnabled() {
    return this.enabled;
  }

  async canViewerManageIntegrationForOrganization(organizationId: string) {
    if (this.isEnabled() === false) {
      return false;
    }

    try {
      await this.authManager.ensureOrganizationAccess({
        organization: organizationId,
        scope: OrganizationAccessScope.INTEGRATIONS,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getOIDCIntegrationForOrganization(args: {
    organizationId: string;
  }): Promise<OIDCIntegration | null> {
    this.logger.debug(
      'getting oidc integration for organization (organizationId=%s)',
      args.organizationId,
    );
    if (this.isEnabled() === false) {
      this.logger.debug('oidc integrations are disabled.');
      return null;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: args.organizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    return await this.storage.getOIDCIntegrationForOrganization({
      organizationId: args.organizationId,
    });
  }

  async getClientSecretPreview(integration: OIDCIntegration) {
    const decryptedSecret = this.crypto.decrypt(integration.encryptedClientSecret);
    return decryptedSecret.substring(decryptedSecret.length - 4);
  }

  async createOIDCIntegrationForOrganization(args: {
    organizationId: string;
    clientId: string;
    clientSecret: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    authorizationEndpoint: string;
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

    if (!organization) {
      throw new Error(`Failed to locate organization ${args.organizationId}`);
    }

    const clientIdResult = OIDCIntegrationClientIdModel.safeParse(args.clientId);
    const clientSecretResult = OIDCClientSecretModel.safeParse(args.clientSecret);
    const tokenEndpointResult = OAuthAPIUrlModel.safeParse(args.tokenEndpoint);
    const userinfoEndpointResult = OAuthAPIUrlModel.safeParse(args.userinfoEndpoint);
    const authorizationEndpointResult = OAuthAPIUrlModel.safeParse(args.authorizationEndpoint);

    if (
      clientIdResult.success &&
      clientSecretResult.success &&
      tokenEndpointResult.success &&
      userinfoEndpointResult.success &&
      authorizationEndpointResult.success
    ) {
      const creationResult = await this.storage.createOIDCIntegrationForOrganization({
        organizationId: args.organizationId,
        clientId: clientIdResult.data,
        encryptedClientSecret: this.crypto.encrypt(clientSecretResult.data),
        tokenEndpoint: tokenEndpointResult.data,
        userinfoEndpoint: userinfoEndpointResult.data,
        authorizationEndpoint: authorizationEndpointResult.data,
      });

      if (creationResult.type === 'ok') {
        return creationResult;
      }

      return {
        type: 'error',
        message: creationResult.reason,
        fieldErrors: {
          clientId: null,
          clientSecret: null,
          tokenEndpoint: null,
          userinfoEndpoint: null,
          authorizationEndpoint: null,
        },
      } as const;
    }

    return {
      type: 'error',
      reason: null,
      fieldErrors: {
        clientId: clientIdResult.success ? null : clientIdResult.error.issues[0].message,
        clientSecret: clientSecretResult.success
          ? null
          : clientSecretResult.error.issues[0].message,
        tokenEndpoint: tokenEndpointResult.success
          ? null
          : tokenEndpointResult.error.issues[0].message,
        userinfoEndpoint: userinfoEndpointResult.success
          ? null
          : userinfoEndpointResult.error.issues[0].message,
        authorizationEndpoint: authorizationEndpointResult.success
          ? null
          : authorizationEndpointResult.error.issues[0].message,
      },
    } as const;
  }

  async updateOIDCIntegration(args: {
    oidcIntegrationId: string;
    clientId: string | null;
    clientSecret: string | null;
    tokenEndpoint: string | null;
    userinfoEndpoint: string | null;
    authorizationEndpoint: string | null;
  }) {
    if (this.isEnabled() === false) {
      return {
        type: 'error',
        message: 'OIDC integrations are disabled.',
      } as const;
    }

    const integration = await this.storage.getOIDCIntegrationById({
      oidcIntegrationId: args.oidcIntegrationId,
    });

    if (integration === null) {
      return {
        type: 'error',
        message: 'Integration not found.',
        fieldErrors: {
          clientId: null,
          clientSecret: null,
          oauthApiUrl: null,
        },
      } as const;
    }

    await this.authManager.ensureOrganizationAccess({
      organization: integration.linkedOrganizationId,
      scope: OrganizationAccessScope.INTEGRATIONS,
    });

    const clientIdResult = maybe(OIDCIntegrationClientIdModel).safeParse(args.clientId);
    const clientSecretResult = maybe(OIDCClientSecretModel).safeParse(args.clientSecret);
    const tokenEndpointResult = maybe(OAuthAPIUrlModel).safeParse(args.tokenEndpoint);
    const userinfoEndpointResult = maybe(OAuthAPIUrlModel).safeParse(args.userinfoEndpoint);
    const authorizationEndpointResult = maybe(OAuthAPIUrlModel).safeParse(
      args.authorizationEndpoint,
    );

    if (
      clientIdResult.success &&
      clientSecretResult.success &&
      tokenEndpointResult.success &&
      userinfoEndpointResult.success &&
      authorizationEndpointResult.success
    ) {
      const oidcIntegration = await this.storage.updateOIDCIntegration({
        oidcIntegrationId: args.oidcIntegrationId,
        clientId: clientIdResult.data,
        encryptedClientSecret: clientSecretResult.data
          ? this.crypto.encrypt(clientSecretResult.data)
          : null,
        tokenEndpoint: tokenEndpointResult.data,
        userinfoEndpoint: userinfoEndpointResult.data,
        authorizationEndpoint: authorizationEndpointResult.data,
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
        clientSecret: clientSecretResult.success
          ? null
          : clientSecretResult.error.issues[0].message,
        tokenEndpoint: tokenEndpointResult.success
          ? null
          : tokenEndpointResult.error.issues[0].message,
        userinfoEndpoint: userinfoEndpointResult.success
          ? null
          : userinfoEndpointResult.error.issues[0].message,
        authorizationEndpoint: authorizationEndpointResult.success
          ? null
          : authorizationEndpointResult.error.issues[0].message,
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

    const integration = await this.storage.getOIDCIntegrationById({
      oidcIntegrationId: args.oidcIntegrationId,
    });

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

  async getOIDCIntegrationById(args: { oidcIntegrationId: string }) {
    if (this.isEnabled() === false) {
      return {
        type: 'error',
        message: 'OIDC integrations are disabled.',
      } as const;
    }

    const integration = await this.storage.getOIDCIntegrationById({
      oidcIntegrationId: args.oidcIntegrationId,
    });

    if (integration === null) {
      return {
        type: 'error',
        message: 'Integration not found.',
      } as const;
    }

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

const OAuthAPIUrlModel = zod.string().url('Must be a valid OAuth API url.');

const maybe = <TSchema>(schema: zod.ZodSchema<TSchema>) => zod.union([schema, zod.null()]);
