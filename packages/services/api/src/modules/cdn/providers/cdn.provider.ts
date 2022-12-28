import { createHmac } from 'crypto';
import type { Span } from '@sentry/types';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { HiveError } from '../../../shared/errors';
import { sentry } from '../../../shared/sentry';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import type { CDNConfig } from './tokens';
import { CDN_CONFIG } from './tokens';

type CdnResourceType = 'schema' | 'supergraph' | 'metadata';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CdnProvider {
  private logger: Logger;
  private encoder: TextEncoder;
  private secretKeyData: Uint8Array;

  constructor(
    logger: Logger,
    private httpClient: HttpClient,
    @Inject(CDN_CONFIG) private config: CDNConfig,
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

  generateToken(targetId: string): string {
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
