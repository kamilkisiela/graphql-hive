import { DocumentNode, GraphQLError, parse, print, SourceLocation } from 'graphql';
import { z } from 'zod';
import type { Logger } from '@graphql-hive/logger';
import type { Change } from '@graphql-inspector/core';
import { errors, patch } from '@graphql-inspector/patch';
import type { Project, SchemaObject } from '@hive/api';
import type { ComposeAndValidateResult } from '@hive/api/shared/entities';
import { PostgresDatabasePool, psql } from '@hive/postgres';
import type { ContractsInputType, SchemaBuilderApi } from '@hive/schema';
import { decodeCreatedAtAndUUIDIdBasedCursor, HiveSchemaChangeModel } from '@hive/storage';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

type SchemaProviderConfig = {
  /** URL of the Schema Service */
  schemaServiceUrl: string;
  logger: Logger;
};

const SchemaModel = z.object({
  id: z.string().uuid(),
  sdl: z.string(),
  serviceName: z.string().nullable(),
  serviceUrl: z.string().nullable(),
  type: z.string(),
});

const SchemaProposalChangesModel = z.object({
  id: z.string().uuid(),
  serviceName: z.string().nullable(),
  serviceUrl: z.string().nullable(),
  schemaProposalChanges: z.array(HiveSchemaChangeModel).default([]),
  createdAt: z.string(),
});

function createExternalConfig(config: Project['externalComposition']) {
  // : ExternalCompositionConfig {
  if (config && config.enabled) {
    if (!config.endpoint) {
      throw new Error('External composition error: endpoint is missing');
    }

    if (!config.encryptedSecret) {
      throw new Error('External composition error: encryptedSecret is missing');
    }

    return {
      endpoint: config.endpoint,
      encryptedSecret: config.encryptedSecret,
    };
  }

  return null;
}

export class GraphQLDocumentStringInvalidError extends Error {
  constructor(message: string, location?: SourceLocation) {
    const locationString = location ? ` at line ${location.line}, column ${location.column}` : '';
    super(`The provided SDL is not valid${locationString}\n: ${message}`);
  }
}

export type CreateSchemaObjectInput = {
  sdl: string;
  serviceName?: string | null;
  serviceUrl?: string | null;
};

export const emptySource = '*';

export function createSchemaObject(schema: CreateSchemaObjectInput): SchemaObject {
  let document: DocumentNode;

  try {
    document = parse(schema.sdl, {
      noLocation: true,
    });
  } catch (err) {
    if (err instanceof GraphQLError) {
      throw new GraphQLDocumentStringInvalidError(err.message, err.locations?.[0]);
    }
    throw err;
  }

  return {
    document,
    raw: schema.sdl,
    source: schema.serviceName ?? emptySource,
    url: schema.serviceUrl ?? null,
  };
}

export type SchemaProvider = ReturnType<typeof schemaProvider>;

export function convertProjectType(t: string) {
  const result = (
    {
      ['FEDERATION']: 'federation',
      ['SINGLE']: 'single',
      ['STITCHING']: 'stitching',
    } as const
  )[t];

  if (!result) {
    throw new Error('Invalid project type.');
  }
  return result;
}

export function schemaProvider(providerConfig: SchemaProviderConfig) {
  const schemaService = createTRPCProxyClient<SchemaBuilderApi>({
    links: [
      httpLink({
        url: `${providerConfig.schemaServiceUrl}/trpc`,
        fetch,
      }),
    ],
  });

  return {
    id: 'schema' as const,
    /**
     * Compose and validate schemas via the schema service.
     * - Requests time out after 60 seconds and result in a human readable error response
     * - In case the incoming request is canceled, the call to the schema service is aborted
     */
    async composeAndValidate(
      projectType: string,
      schemas: SchemaObject[],
      config: {
        /** Whether external composition should be used (only Federation) */
        external: Project['externalComposition'];
        /** Whether native composition should be used (only Federation) */
        native: boolean;
        /** Specified contracts (only Federation) */
        contracts: ContractsInputType | null;
      },
    ) {
      const compositionType = convertProjectType(projectType);
      providerConfig.logger.debug(
        'Composing and validating schemas (type=%s, method=%s)',
        compositionType,
        compositionType === 'federation'
          ? config.native
            ? 'native'
            : config.external.enabled
              ? 'external'
              : 'v1'
          : 'none',
      );

      // Deadlock guard for a hanging schema service. The schema service enforces the composition
      // budget itself (SCHEMA_COMPOSITION_TIMEOUT_MS, 60s by default) and answers with a structured
      // error, so this must not be lower than that value.
      const timeoutAbortSignal = AbortSignal.timeout(60_000);

      const onTimeout = () => {
        providerConfig.logger.debug(
          'Composition HTTP request aborted due to timeout of 60 seconds.',
        );
      };
      timeoutAbortSignal.addEventListener('abort', onTimeout);

      try {
        const result = await schemaService.composeAndValidate.mutate(
          {
            type: compositionType,
            schemas: schemas.map(s => ({
              raw: s.raw,
              source: s.source,
              url: s.url ?? null,
            })),
            external: createExternalConfig(config.external),
            native: config.native,
            contracts: config.contracts,
          },
          {
            // Limit the maximum time allowed for composition requests to 60 seconds to avoid a dead-lock
            signal: timeoutAbortSignal,
          },
        );
        return result;
      } catch (err) {
        // In case of a timeout error we return something the user can process
        if (timeoutAbortSignal.reason) {
          return {
            contracts: null,
            metadataAttributes: null,
            schemaMetadata: null,
            sdl: null,
            supergraph: null,
            tags: null,
            includesNetworkError: true,
            includesException: false,
            errors: [
              {
                message: 'The schema composition timed out. Please try again.',
                source: 'composition',
              },
            ],
          } satisfies ComposeAndValidateResult;
        }

        throw err;
      } finally {
        timeoutAbortSignal.removeEventListener('abort', onTimeout);
      }
    },

    async updateSchemaProposalComposition(args: {
      proposalId: string;
      timestamp: string;
      reason: string | null;
      status: 'ERROR' | 'SUCCESS';
      pool: PostgresDatabasePool;
    }) {
      const { pool, ...state } = args;
      await pool.query(
        psql`/* updateSchemaProposalComposition */
          UPDATE schema_proposals
          SET
              composition_status = ${state.status}
            , composition_timestamp = ${state.timestamp}
            , composition_status_reason = ${state.reason}
          WHERE id=${state.proposalId}`,
      );
    },

    async latestComposableSchemas(args: { targetId: string; pool: PostgresDatabasePool }) {
      const latestVersionId = await args.pool
        .maybeOneFirst(
          psql`/* findLatestComposableSchemaVersion */
        SELECT sv.id
        FROM schema_versions as sv
        WHERE
          sv.target_id = ${args.targetId}
          AND sv.is_composable IS TRUE
          AND (
            /* Legacy records */
            sv.graph_metadata IS NULL
            OR (
              /* Default graph records, contract versions of the target are excluded */
              sv.graph_metadata->>'name' = 'default'
              AND sv.graph_metadata->>'type' = 'default'
            )
          )
        ORDER BY sv.created_at DESC, sv.id DESC
        LIMIT 1
      `,
        )
        .then(z.string().nullable().parse);

      if (!latestVersionId) {
        return [];
      }

      const result = await args.pool.any(
        psql`/* getSchemasOfVersion */
          SELECT
              sl.id
            , sl.sdl
            , lower(sl.service_name) as "serviceName"
            , sl.service_url as "serviceUrl"
            , p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${latestVersionId}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
          ORDER BY
            sl.created_at DESC
        `,
      );
      return result.map(row => SchemaModel.parse(row));
    },

    async getBaseSchema(args: { targetId: string; pool: PostgresDatabasePool }) {
      const baseSchema = await args.pool
        .maybeOneFirst(
          psql`/* getBaseSchema */ SELECT base_schema FROM targets WHERE id=${args.targetId}`,
        )
        .then(z.string().nullable().parse);
      return baseSchema;
    },

    async proposedSchemas(args: {
      targetId: string;
      proposalId: string;
      cursor?: string | null;
      pool: PostgresDatabasePool;
    }) {
      const now = new Date().toISOString();
      let cursor: {
        createdAt: string;
        id: string;
      } | null = null;

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      // fetch all latest schemas. Support up to 2_000 subgraphs.
      const maxLoops = 100;
      const services = await this.latestComposableSchemas({
        targetId: args.targetId,
        pool: args.pool,
      });

      let nextCursor = cursor;
      // collect changes in paginated requests to avoid stalling the db
      let i = 0;
      do {
        const result = await args.pool.any(psql`
          SELECT
              c."id"
            , c."service_name" as "serviceName"
            , c."service_url" as "serviceUrl"
            , c."schema_proposal_changes" as "schemaProposalChanges"
            , to_json(c."created_at") as "createdAt"
          FROM
            "schema_checks" as c
            INNER JOIN (
              SELECT COALESCE("service_name", '') as "service", "schema_proposal_id", max("created_at") as "maxdate"
              FROM schema_checks
              ${
                cursor
                  ? psql`
                    WHERE "schema_proposal_id" = ${args.proposalId}
                    AND (
                      (
                        "created_at" = ${cursor.createdAt}
                        AND "id" < ${cursor.id}
                      )
                      OR "created_at" < ${cursor.createdAt}
                    )
                  `
                  : psql``
              }
              GROUP BY "service", "schema_proposal_id"
            ) as cc
            ON c."schema_proposal_id" = cc."schema_proposal_id"
              AND COALESCE(c."service_name", '') = cc."service"
              AND c."created_at" = cc."maxdate"
          WHERE
            c."target_id" = ${args.targetId}
            AND c."schema_proposal_id" = ${args.proposalId}
            ${
              cursor
                ? psql`
                  AND (
                    (
                      c."created_at" = ${cursor.createdAt}
                      AND c."id" < ${cursor.id}
                    )
                    OR c."created_at" < ${cursor.createdAt}
                  )
                `
                : psql``
            }
          ORDER BY
              c."created_at" DESC
            , c."id" DESC
          LIMIT 20
        `);

        const changes = result.map(row => {
          const value = SchemaProposalChangesModel.parse(row);
          return {
            ...value,
            schemaProposalChanges: value.schemaProposalChanges.map(c => {
              const change: Change<any> = {
                ...c,
                path: c.path ?? undefined,
                criticality: {
                  level: c.criticality,
                },
              };
              return change;
            }),
          };
        });

        if (changes.length === 20) {
          nextCursor = {
            // Keep the created at because we want the same set of checks when joining on the "latest".
            createdAt: nextCursor?.createdAt ?? changes[0]?.createdAt ?? now,
            id: changes[changes.length - 1].id,
          };
        } else {
          nextCursor = null;
        }

        for (const change of changes) {
          const service = services.find(s => change.serviceName === s.serviceName);
          if (service) {
            const ast = parse(service.sdl, { noLocation: true });
            service.sdl = print(
              patch(ast, change.schemaProposalChanges, { onError: errors.looseErrorHandler }),
            );
            if (change.serviceUrl) {
              service.serviceUrl = change.serviceUrl;
            }
          }
        }
      } while (nextCursor && ++i < maxLoops);

      return services;
    },
  };
}
