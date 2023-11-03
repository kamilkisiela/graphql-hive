import bcryptjs from 'bcryptjs';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { encodeCdnToken, generatePrivateKey } from '@hive/cdn-script/cdn-token';
import type { Span } from '@sentry/types';
import { crypto } from '@whatwg-node/fetch';
import { HiveError } from '../../../shared/errors';
import { isUUID } from '../../../shared/is-uuid';
import { sentry } from '../../../shared/sentry';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/scopes';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { S3_CONFIG, type S3Config } from '../../shared/providers/s3-config';
import { Storage } from '../../shared/providers/storage';
import { CDN_CONFIG, type CDNConfig } from './tokens';

type CdnResourceType = 'schema' | 'supergraph' | 'metadata';

const s3KeyPrefix = 'cdn-keys';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CdnProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private httpClient: HttpClient,
    @Inject(AuthManager) private authManager: AuthManager,
    @Inject(CDN_CONFIG) private config: CDNConfig,
    @Inject(S3_CONFIG) private s3Config: S3Config,
    @Inject(Storage) private storage: Storage,
  ) {
    this.logger = logger.child({ source: 'CdnProvider' });
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

  async createCDNAccessToken(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    alias: string;
  }) {
    this.logger.debug(
      'Creating CDN Access Token. (targetId=%s, projectId=%s, targetId=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
    );

    const alias = AliasStringModel.safeParse(args.alias);

    if (alias.success === false) {
      this.logger.debug(
        'Failed creating CDN Access Token. Validation failed. (targetId=%s, projectId=%s, targetId=%s)',
        args.targetId,
        args.projectId,
        args.targetId,
      );

      return {
        type: 'failure',
        reason: alias.error.issues[0].message,
      } as const;
    }

    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.READ,
    });

    // generate all things upfront so we do net get surprised by encoding issues after writing to the destination.
    const keyId = crypto.randomUUID();
    const s3Key = `${s3KeyPrefix}/${args.targetId}/${keyId}`;
    const privateKey = generatePrivateKey();
    const privateKeyHash = await bcryptjs.hash(privateKey, await bcryptjs.genSalt());
    const cdnAccessToken = encodeCdnToken({ keyId, privateKey });

    this.logger.debug(
      'Check CDN access token key availability on S3. (targetId=%s, projectId=%s, targetId=%s, key=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
      s3Key,
    );

    // Check if key already exists
    const headResponse = await this.s3Config.client.fetch(
      [this.s3Config.endpoint, this.s3Config.bucket, s3Key].join('/'),
      {
        method: 'HEAD',
      },
    );

    if (headResponse.status !== 404) {
      this.logger.debug(
        'Failed creating CDN access token. Head request on S3 returned unexpected status while checking token availability. ( targetId=%s, projectId=%s, targetId=%s, status=%s)',
        args.targetId,
        args.projectId,
        args.targetId,
        headResponse.status,
      );
      this.logger.debug(await headResponse.text());

      return {
        type: 'failure',
        reason: 'Failed to generate key. Please try again later.',
      } as const;
    }

    this.logger.debug(
      'Store CDN access token on S3. (targetId=%s, projectId=%s, targetId=%s, key=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
      s3Key,
    );

    // put key onto s3 bucket
    const putResponse = await this.s3Config.client.fetch(
      [this.s3Config.endpoint, this.s3Config.bucket, s3Key].join('/'),
      {
        method: 'PUT',
        body: privateKeyHash,
      },
    );

    if (putResponse.status !== 200) {
      this.logger.debug(
        'Failed creating CDN Access Token. Head request on S3 returned unexpected status while creating token. ( targetId=%s, projectId=%s, targetId=%s, status=%s)',
        args.targetId,
        args.projectId,
        args.targetId,
        headResponse.status,
      );
      this.logger.error(await putResponse.text());

      return {
        type: 'failure',
        reason: 'Failed to generate key. Please try again later. 2',
      } as const;
    }

    this.logger.debug(
      'Successfully stored CDN access token on S3. (targetId=%s, projectId=%s, targetId=%s, key=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
      s3Key,
    );

    this.logger.debug(
      'Insert CDN access token into PG. (targetId=%s, projectId=%s, targetId=%s, key=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
      s3Key,
    );

    const cdnAccessTokenRecord = await this.storage.createCDNAccessToken({
      id: keyId,
      targetId: args.targetId,
      firstCharacters: cdnAccessToken.substring(0, 5),
      lastCharacters: cdnAccessToken.substring(cdnAccessToken.length - 5, cdnAccessToken.length),
      s3Key,
      alias: args.alias,
    });

    if (cdnAccessTokenRecord === null) {
      return {
        type: 'failure',
        reason: 'Failed to generate key. Please try again later.',
      } as const;
    }

    this.logger.debug(
      'Successfully created CDN access token. (targetId=%s, projectId=%s, targetId=%s, key=%s)',
      args.targetId,
      args.projectId,
      args.targetId,
      s3Key,
    );

    return {
      type: 'success',
      cdnAccessToken: cdnAccessTokenRecord,
      secretAccessToken: cdnAccessToken,
    } as const;
  }

  public async deleteCDNAccessToken(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    cdnAccessTokenId: string;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.SETTINGS,
    });

    if (isUUID(args.cdnAccessTokenId) === false) {
      return {
        type: 'failure',
        reason: 'The CDN Access Token does not exist.',
      } as const;
    }

    // TODO: this should probably happen within a db transaction to ensure integrity
    const record = await this.storage.getCDNAccessTokenById({
      cdnAccessTokenId: args.cdnAccessTokenId,
    });

    if (record === null || record.targetId !== args.targetId) {
      return {
        type: 'failure',
        reason: 'The CDN Access Token does not exist.',
      } as const;
    }

    const headResponse = await this.s3Config.client.fetch(
      [this.s3Config.endpoint, this.s3Config.bucket, record.s3Key].join('/'),
      {
        method: 'DELETE',
      },
    );

    if (headResponse.status !== 204) {
      return {
        type: 'failure',
        reason: 'Failed deleting CDN Access Token. Please try again later.',
      } as const;
    }

    await this.storage.deleteCDNAccessToken({
      cdnAccessTokenId: args.cdnAccessTokenId,
    });

    if (record === null) {
      return {
        type: 'failure',
        reason: 'The CDN Access Token. Does not exist.',
      } as const;
    }

    return {
      type: 'success',
    } as const;
  }

  public async getPaginatedCDNAccessTokensForTarget(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    first: number | null;
    cursor: string | null;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.SETTINGS,
    });

    const paginatedResult = await this.storage.getPaginatedCDNAccessTokensForTarget({
      targetId: args.targetId,
      first: args.first,
      cursor: args.cursor,
    });

    return paginatedResult;
  }
}

const AliasStringModel = z
  .string()
  .min(3, 'Must be at least 3 characters long.')
  .max(100, 'Can not be longer than 100 characters.');
