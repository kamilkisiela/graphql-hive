import { createHmac } from 'crypto';
import bcryptjs from 'bcryptjs';
import { Inject, Injectable, Scope } from 'graphql-modules';
import type { Span } from '@sentry/types';
import { HiveError } from '../../../shared/errors';
import { sentry } from '../../../shared/sentry';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/scopes';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { type S3Config, S3_CONFIG } from '../../shared/providers/s3-config';
import { Storage } from '../../shared/providers/storage';
import type { CDNConfig } from './tokens';
import { CDN_CONFIG } from './tokens';

type CdnResourceType = 'schema' | 'supergraph' | 'metadata';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CdnProvider {
  private logger: Logger;
  private encoder: TextEncoder;
  private secretKeyData: Uint8Array;

  constructor(
    logger: Logger,
    private httpClient: HttpClient,
    @Inject(AuthManager) private authManager: AuthManager,
    @Inject(CDN_CONFIG) private config: CDNConfig,
    @Inject(S3_CONFIG) private s3Config: S3Config,
    @Inject(Storage) private storage: Storage,
  ) {
    this.logger = logger.child({ source: 'CdnProvider' });
    this.encoder = new TextEncoder();
    this.secretKeyData = this.encoder.encode(this.config.authPrivateKey);
  }

  isEnabled(): boolean {
    return this.config.providers.api !== null || this.config.providers.cloudflare !== null;
  }

  getCdnUrlForTarget(targetId: string): string {
    if (this.config.providers.cloudflare) {
      return `${this.config.providers.cloudflare.baseUrl}/artifacts/v1/${targetId}`;
    }
    if (this.config.providers.api) {
      return `${this.config.providers.api.baseUrl}/artifacts/v1/${targetId}`;
    }

    throw new HiveError(`CDN is not configured, cannot resolve CDN target url.`);
  }

  async generateCdnAccess(args: { organizationId: string; projectId: string; targetId: string }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const token = this.legacy_generateToken(args.targetId);
    const tokenHash = await bcryptjs.hash(token, await bcryptjs.genSalt());
    const url = this.getCdnUrlForTarget(args.targetId);

    const s3Key = `cdn-legacy-keys/${args.targetId}`;

    const s3Url = [this.s3Config.endpoint, this.s3Config.bucket, s3Key].join('/');
    const response = await this.s3Config.client.fetch(s3Url, {
      method: 'PUT',
      body: tokenHash,
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected Status for storing key. (status=${response.status})`);
    }

    await this.storage.createCDNAccessToken({
      targetId: args.targetId,
      s3Key,
      firstCharacters: token.substring(0, 3),
      lastCharacters: token.substring(token.length - 3),
    });

    return {
      token,
      url,
    };
  }

  private legacy_generateToken(targetId: string): string {
    return createHmac('sha256', this.secretKeyData)
      .update(this.encoder.encode(targetId))
      .digest('base64');
  }

  async pushToCloudflareCDN(url: string, body: string, span?: Span): Promise<{ success: boolean }> {
    if (this.config.providers.cloudflare === null) {
      this.logger.info(`Trying to push to the CDN, but CDN is not configured, skipping`);
      return { success: false };
    }

    return this.httpClient.put<{ success: boolean }>(
      url,
      {
        headers: {
          'content-type': 'text/plain',
          authorization: `Bearer ${this.config.providers.cloudflare.authToken}`,
        },
        body,
        responseType: 'json',
        retry: {
          limit: 3,
        },
        timeout: {
          request: 10_000,
        },
      },
      span,
    );
  }

  @sentry('CdnProvider.publish')
  async publish(
    {
      targetId,
      resourceType,
      value,
    }: {
      targetId: string;
      resourceType: CdnResourceType;
      value: string;
    },
    span?: Span,
  ): Promise<void> {
    if (this.config.providers.cloudflare === null) {
      this.logger.info(`Trying to publish to the CDN, but CDN is not configured, skipping`);
      return;
    }

    const target = `target:${targetId}`;
    this.logger.info(
      `Publishing data to CDN based on target: "${target}", resourceType is: ${resourceType} ...`,
    );
    const CDN_SOURCE = `${this.config.providers.cloudflare.basePath}/${this.config.providers.cloudflare.accountId}/storage/kv/namespaces/${this.config.providers.cloudflare.namespaceId}/values/${target}`;

    this.logger.info(`Data published to CDN: ${value}`);
    const result = await this.pushToCloudflareCDN(`${CDN_SOURCE}:${resourceType}`, value, span);

    if (!result.success) {
      return Promise.reject(
        new HiveError(`Failed to publish to CDN, response: ${JSON.stringify(result)}`),
      );
    }

    this.logger.info(
      `Published to CDN based on target: "${target}", resourceType is: ${resourceType} is done, response: %o`,
      result,
    );
  }
}
