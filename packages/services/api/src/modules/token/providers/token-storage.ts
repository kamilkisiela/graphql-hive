import { createHash } from 'node:crypto';
import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { redisBusDriver, redisDriver } from 'bentocache/drivers/redis';
import { FactoryProvider, Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import { sql } from 'slonik';
import { z } from 'zod';
import type { Token } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { atomic } from '../../../shared/helpers';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { TargetAccessScope } from '../../auth/providers/target-access';
import { FASTIFY_LOGGER, FastifyLogger, Logger } from '../../shared/providers/logger';
import { Redis, REDIS_INSTANCE } from '../../shared/providers/redis';
import type { Storage, TargetSelector } from '../../shared/providers/storage';

// TODO: port -> import { cacheHits, cacheInvalidations, cacheMisses } from './metrics';

export interface TokenSelector {
  token: string;
}

interface CreateTokenInput extends TargetSelector {
  name: string;
  scopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
}

export interface CreateTokenResult extends Token {
  secret: string;
}

const TokenRowSchema = z.object({
  token: z.string().min(1),
  token_alias: z.string().min(1),
  name: z.string().min(1),
  created_at: z.string().min(1),
  last_used_at: z.string().min(1),
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  target_id: z.string().min(1),
  scopes: z.array(z.string().min(1)),
});

export interface TokenDetails {
  token: string;
  name: string;
  tokenAlias: string;
  date: string;
  lastUsedAt: string;
  organization: string;
  project: string;
  target: string;
  scopes: readonly string[];
}

type TokensCache = BentoCache<{
  multitier: ReturnType<typeof bentostore>;
}>;

const TOKENS_CACHE = new InjectionToken<TokensCache>('TOKENS_CACHE');

export const provideTokensCache: FactoryProvider<TokensCache> = {
  provide: TOKENS_CACHE,
  scope: Scope.Singleton,
  useFactory(logger: FastifyLogger, redisConnection: Redis) {
    return new BentoCache({
      default: 'multitier',
      prefix: 'tokens',
      logger: logger.child({ source: 'TokensSingleton' }),
      // Store the tokens for 1 day, but allow early expiration
      ttl: '1d',
      // When it's 80% of the time to live, refresh the token
      earlyExpiration: 0.8,
      timeouts: {
        soft: '5s',
        hard: '10s',
      },
      stores: {
        multitier: bentostore()
          // Your L1 Cache. Here, an in-memory cache with
          // a maximum size of 100Mb
          .useL1Layer(memoryDriver({ maxSize: 100 * 1024 * 1024 }))
          // Your L2 Cache. Here, a Redis cache
          .useL2Layer(redisDriver({ connection: redisConnection }))
          // Finally, the bus to synchronize the L1 caches between
          // the different instances of your application
          .useBus(redisBusDriver({ connection: redisConnection.options })),
      },
    });
  },
  deps: [FASTIFY_LOGGER, REDIS_INSTANCE],
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function maskToken(token: string) {
  return token.substring(0, 3) + '*'.repeat(token.length - 6) + token.substring(token.length - 3);
}

function generateToken() {
  const token = createHash('md5')
    .update(String(Math.random()))
    .update(String(Date.now()))
    .digest('hex');

  const hash = hashToken(token);
  const alias = maskToken(token);

  return {
    secret: token,
    hash,
    alias,
  };
}

function transformToken(row: z.infer<typeof TokenRowSchema>) {
  return {
    token: row.token,
    tokenAlias: row.token_alias,
    name: row.name,
    date: row.created_at as any,
    lastUsedAt: row.last_used_at as any,
    organization: row.organization_id,
    project: row.project_id,
    target: row.target_id,
    scopes: row.scopes || [],
  };
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TokenStorage {
  private logger: Logger;

  constructor(
    logger: Logger,
    @Inject(TOKENS_CACHE) private tokensCache: TokensCache,
    private storage: Storage,
  ) {
    this.logger = logger.child({ source: 'TokenStorage' });
  }

  async createToken(input: CreateTokenInput) {
    this.logger.debug('Creating new token (input=%o)', input);

    const token = generateToken();
    return await this.storage.pool.transaction(async trx => {
      const dbResult = TokenRowSchema.parse(
        await trx.one<{}>(
          sql`
            INSERT INTO tokens
              (name, token, token_alias, target_id, project_id, organization_id, scopes)
            VALUES
              (${input.name}, ${token.hash}, ${token.alias}, ${input.target}, ${input.project}, ${input.organization}, ${sql.array(
                input.scopes,
                'text',
              )})
            RETURNING *
          `,
        ),
      );

      const result = transformToken(dbResult);

      const wroteToCache = await this.tokensCache.set(token.hash, {
        token: result.token,
        tokenAlias: result.tokenAlias,
        name: result.name,
        date: result.date,
        lastUsedAt: result.lastUsedAt,
        organization: result.organization,
        project: result.project,
        target: result.target,
        scopes: result.scopes,
      });

      if (!wroteToCache) {
        throw new Error('Failed to write to cache');
      }

      return {
        ...result,
        secret: token.secret,
      };
    });
  }

  async deleteTokens(
    input: {
      tokens: string[];
    } & TargetSelector,
  ): Promise<readonly string[]> {
    this.logger.debug('Deleting tokens (input=%o)', input);

    await this.storage.pool.transaction(async trx => {
      await trx.query(
        sql`
          UPDATE tokens SET deleted_at = NOW() WHERE token = ANY(${sql.array(input.tokens, 'text')}})
        `,
      );
      const deletedFromCache = await this.tokensCache.deleteMany(input.tokens);

      // TODO: check if false is handled correctly
      if (!deletedFromCache) {
        throw new Error('Failed to delete tokens from cache');
      }
    });

    return input.tokens;
  }

  async invalidateTokens(tokens: string[]) {
    this.logger.debug('Invalidating tokens (size=%s)', tokens.length);

    if (
      await this.tokensCache.deleteMany(tokens).catch(error => {
        this.logger.error(error);
      })
    ) {
      this.logger.debug('Invalidated tokens (size=%s)', tokens.length);
      return;
    }

    // TODO: check if false is handled correctly
    this.logger.warn('Failed to invalidate tokens (size=%s)', tokens.length);
  }

  async getTokens(selector: TargetSelector) {
    this.logger.debug('Fetching tokens (selector=%o)', selector);
    const dbResult = await this.storage.pool.many<{}>(
      sql`
        SELECT *
        FROM tokens
        WHERE
          target_id = ${selector.target}
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
    );

    return dbResult.map(row => transformToken(TokenRowSchema.parse(row)));
  }

  // this could
  @atomic<TokenSelector>(({ token }) => token)
  async getToken({ token }: TokenSelector) {
    try {
      // Tokens are MD5 hashes, so they are always 32 characters long
      if (token.length !== 32) {
        throw new HiveError(`Incorrect length: received ${token.length}, expected 32`);
      }

      this.logger.debug('Fetching token (token=%s)', maskToken(token));
      const tokenInfo = await this.tokensCache.get<TokenDetails>(token);

      if (!tokenInfo) {
        throw new HiveError('Not found');
      }

      return tokenInfo;
    } catch (error: any) {
      if (!(error instanceof HiveError)) {
        this.logger.error(error);
      }

      throw new HiveError('Invalid token provided', {
        originalError: error,
      });
    }
  }
}
