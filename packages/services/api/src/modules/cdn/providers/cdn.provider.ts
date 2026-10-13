import bcryptjs from 'bcryptjs';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { encodeCdnToken, generatePrivateKey } from '@hive/cdn-script/cdn-token';
import { maskToken } from '@hive/service-common';
import * as GraphQLSchema from '../../../__generated__/types';
import { HiveError } from '../../../shared/errors';
import { isUUID } from '../../../shared/is-uuid';
import { AuditLogRecorder } from '../../audit-logs/providers/audit-log-recorder';
import { Session } from '../../auth/lib/authz';
import type { ContractGraph } from '../../graph/providers/graph-store';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { S3Writer } from '../../shared/providers/s3-writer';
import { Storage } from '../../shared/providers/storage';
import { CDN_CONFIG, type CDNConfig } from './tokens';

const s3KeyPrefix = 'cdn-keys';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CdnProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private session: Session,
    private auditLog: AuditLogRecorder,
    private idTranslator: IdTranslator,
    @Inject(CDN_CONFIG) private config: CDNConfig,
    private s3: S3Writer,
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

  getCdnUrlForContractGraph(graph: ContractGraph): string {
    if (this.config.providers.cloudflare) {
      return `${this.config.providers.cloudflare.baseUrl}/artifacts/v1/${graph.targetId}/contracts/${graph.name.replace(/^default\//, '')}`;
    }
    if (this.config.providers.api) {
      return `${this.config.providers.api.baseUrl}/artifacts/v1/${graph.targetId}/contracts/${graph.name.replace(/^default\//, '')}`;
    }

    throw new HiveError(`CDN is not configured, cannot resolve CDN contract url.`);
  }

  async createCDNAccessToken(args: { target: GraphQLSchema.TargetReferenceInput; alias: string }) {
    this.logger.debug('Creating CDN Access Token. (target=%o)', args.target);

    if (this.isEnabled() === false) {
      this.logger.debug('CDN is disabled. Skip creation. (target=%o)', args.target);
      throw new HiveError(`CDN is not configured, cannot generate a token.`);
    }

    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.target,
    });

    if (!selector) {
      this.session.raise('cdnAccessToken:modify');
    }

    const alias = AliasStringModel.safeParse(args.alias);

    if (alias.success === false) {
      this.logger.debug(
        'Failed creating CDN Access Token. Validation failed. (organizationId=%s, projectId=%s, targetId=%s)',
        selector.organizationId,
        selector.projectId,
        selector.targetId,
      );

      return {
        type: 'failure',
        reason: alias.error.issues[0].message,
      } as const;
    }

    await this.session.assertPerformAction({
      action: 'cdnAccessToken:modify',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      },
    });

    // generate all things upfront so we do net get surprised by encoding issues after writing to the destination.
    const keyId = crypto.randomUUID();
    const s3Key = `${s3KeyPrefix}/${selector.targetId}/${keyId}`;
    const privateKey = generatePrivateKey();
    const privateKeyHash = await bcryptjs.hash(privateKey, await bcryptjs.genSalt());
    const cdnAccessToken = encodeCdnToken({ keyId, privateKey });

    this.logger.debug(
      'Check CDN access token key availability on S3. (organizationId=%s, projectId=%s, targetId=%s, key=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
      s3Key,
    );

    const headResponses = await this.s3.request(s3Key, {
      method: 'HEAD',
    });

    for (const headResponse of headResponses) {
      if (headResponse.statusCode !== 404) {
        this.logger.debug(
          'Failed creating CDN access token. Head request on S3 returned unexpected status while checking token availability. (organizationId=%s, projectId=%s, targetId=%s, status=%s)',
          selector.organizationId,
          selector.projectId,
          selector.targetId,
          headResponse.statusCode,
        );
        this.logger.debug(headResponse.body);

        return {
          type: 'failure',
          reason: 'Failed to generate key. Please try again later.',
        } as const;
      }
    }

    this.logger.debug(
      'Store CDN access token on S3. (organizationId=%s, projectId=%s, targetId=%s, key=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
      s3Key,
    );

    const putResponses = await this.s3.write(s3Key, 'cdn_access_token', {
      body: privateKeyHash,
    });

    for (const putResponse of putResponses) {
      if (putResponse.statusCode !== 200) {
        this.logger.debug(
          'Failed creating CDN Access Token. Head request on S3 returned unexpected status while creating token. (organizationId=%s, projectId=%s, targetId=%s, status=%s)',
          selector.organizationId,
          selector.projectId,
          selector.targetId,
          putResponse.statusCode,
        );
        this.logger.error(putResponse.body);

        return {
          type: 'failure',
          reason: 'Failed to generate key. Please try again later. 2',
        } as const;
      }
    }

    this.logger.debug(
      'Successfully stored CDN access token on S3. (organizationId=%s, projectId=%s, targetId=%s, key=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
      s3Key,
    );

    this.logger.debug(
      'Insert CDN access token into PG. (organizationId=%s, projectId=%s, targetId=%s, key=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
      s3Key,
    );

    const cdnAccessTokenRecord = await this.storage.createCDNAccessToken({
      id: keyId,
      targetId: selector.targetId,
      firstCharacters: cdnAccessToken.substring(0, 5),
      lastCharacters: cdnAccessToken.substring(cdnAccessToken.length - 5, cdnAccessToken.length),
      s3Key,
      alias: args.alias,
    });

    if (cdnAccessTokenRecord === null) {
      this.logger.error(
        'Failed inserting CDN access token in PG. (organizationId=%s, projectId=%s, targetId=%s, key=%s)',
        selector.organizationId,
        selector.projectId,
        selector.targetId,
        s3Key,
      );

      return {
        type: 'failure',
        reason: 'Failed to generate key. Please try again later.',
      } as const;
    }

    this.logger.debug(
      'Successfully created CDN access token. (organizationId=%s, projectId=%s, targetId=%s, key=%s, cdnAccessTokenId=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
      s3Key,
      cdnAccessTokenRecord.id,
    );

    const maskedToken = maskToken(cdnAccessToken);
    await this.auditLog.record({
      eventType: 'TARGET_CDN_ACCESS_TOKEN_CREATED',
      organizationId: selector.organizationId,
      metadata: {
        targetId: selector.targetId,
        projectId: selector.projectId,
        alias: args.alias,
        token: maskedToken,
      },
    });

    return {
      type: 'success',
      cdnAccessToken: cdnAccessTokenRecord,
      secretAccessToken: cdnAccessToken,
      cdnUrl: this.getCdnUrlForTarget(selector.targetId),
    } as const;
  }

  public async deleteCDNAccessToken(args: {
    target: GraphQLSchema.TargetReferenceInput;
    cdnAccessTokenId: string;
  }) {
    this.logger.debug(
      'Delete CDN access token. (target=%o, cdnAccessTokenId=%s)',
      args.target,
      args.cdnAccessTokenId,
    );

    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.target,
    });

    if (!selector) {
      this.session.raise('cdnAccessToken:modify');
    }

    await this.session.assertPerformAction({
      action: 'cdnAccessToken:modify',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      },
    });

    if (isUUID(args.cdnAccessTokenId) === false) {
      this.logger.debug(
        'Delete CDN access token error. Non UUID provided. (organizationId=%s, projectId=%s, targetId=%s, cdnAccessTokenId=%s)',
        selector.organizationId,
        selector.projectId,
        selector.targetId,
        args.cdnAccessTokenId,
      );

      return {
        type: 'failure',
        reason: 'The CDN Access Token does not exist.',
      } as const;
    }

    // TODO: this should probably happen within a db transaction to ensure integrity
    const record = await this.storage.getCDNAccessTokenById({
      cdnAccessTokenId: args.cdnAccessTokenId,
    });

    if (record === null || record.targetId !== selector.targetId) {
      this.logger.debug(
        'Delete CDN access token error. Access Token not found in database. (organizationId=%s, projectId=%s, targetId=%s, cdnAccessTokenId=%s)',
        selector.organizationId,
        selector.projectId,
        selector.targetId,
        args.cdnAccessTokenId,
      );
      return {
        type: 'failure',
        reason: 'The CDN Access Token does not exist.',
      } as const;
    }

    const deleteResponses = await this.s3.request(record.s3Key, {
      method: 'DELETE',
    });

    for (const deleteResponse of deleteResponses) {
      if (deleteResponse.statusCode !== 204) {
        this.logger.debug(
          'Delete CDN access token error. Head request on S3 failed. (organizationId=%s, projectId=%s, targetId=%s, cdnAccessTokenId=%s)',
          selector.organizationId,
          selector.projectId,
          selector.targetId,
          args.cdnAccessTokenId,
        );

        return {
          type: 'failure',
          reason: 'Failed deleting CDN Access Token. Please try again later.',
        } as const;
      }
    }

    await this.storage.deleteCDNAccessToken({
      cdnAccessTokenId: args.cdnAccessTokenId,
    });

    await this.auditLog.record({
      eventType: 'TARGET_CDN_ACCESS_TOKEN_DELETED',
      organizationId: selector.organizationId,
      metadata: {
        targetId: selector.targetId,
        projectId: selector.projectId,
        alias: record.alias,
      },
    });

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
    await this.session.assertPerformAction({
      action: 'cdnAccessToken:modify',
      organizationId: args.organizationId,
      params: {
        organizationId: args.organizationId,
        projectId: args.projectId,
        targetId: args.targetId,
      },
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
