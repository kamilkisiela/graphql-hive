import { Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import { z } from 'zod';
import { CommonQueryMethods, PostgresDatabasePool, psql } from '@hive/postgres';
import { invariant, traceFn } from '@hive/service-common';
import {
  ConditionalBreakingChangeMetadata,
  ConditionalBreakingChangeMetadataModel,
  decodeCreatedAtAndUUIDIdBasedCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
  HiveSchemaChangeModel,
  InsertConditionalBreakingChangeMetadataModel,
  SchemaChangeType,
  SchemaCompositionError,
  SchemaCompositionErrorModel,
  toSerializableSchemaChange,
} from '@hive/storage';
import type { Project, Target } from '../../../shared/entities';
import { batch, cache } from '../../../shared/helpers';
import { Graph } from '../../graph/providers/graph-store';
import { Logger, NoopLogger } from '../../shared/providers/logger';
import { SchemaRevisionStore, SchemaRevisionUnavailableError } from './schema-revision-store';

const DefaultGraphMetadataModel = z.object({
  type: z.literal('default'),
  id: z.string(),
  name: z.string(),
});

const ContractGraphMetadataModel = z.object({
  type: z.literal('contract'),
  id: z.string(),
  name: z.string(),
});

const GraphMetadataModel = z.discriminatedUnion('type', [
  ContractGraphMetadataModel,
  DefaultGraphMetadataModel,
]);

type GraphMetadata = z.TypeOf<typeof GraphMetadataModel>;

type GithubMeta = null | {
  sha: string;
  repository: string;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaVersionStore {
  private logger: Logger;

  constructor(
    private pg: PostgresDatabasePool,
    logger: Logger = new NoopLogger(),
  ) {
    this.logger = logger.child({ module: 'SchemaVersionStore' });
  }

  private async insertSchemaVersion(
    trx: CommonQueryMethods,
    args: {
      isComposable: boolean;
      targetId: string;
      origin: SchemaVersionOrigin;
      baseSchema: string | null;
      previousSchemaVersionId: string | null;
      diffSchemaVersionId: string | null;
      compositeSchemaSDL: string | null;
      supergraphSDL: string | null;
      supergraphChanges: Array<SchemaChangeType> | null;
      schemaCompositionErrors: Array<SchemaCompositionError> | null;
      tags: Array<string> | null;
      schemaMetadata: Record<
        string,
        Array<{ name: string; content: string; source: string | null }>
      > | null;
      metadataAttributes: Record<string, string[]> | null;
      hasContractCompositionErrors: boolean;
      github: GithubMeta;
      meta: SchemaVersionMeta | null;
      conditionalBreakingChangeMetadata: ConditionalBreakingChangeMetadata | null;
      /** The UUID of the graph this schema version belongs to */
      graphId: string;
      /**
       * Additional metadata about the graph
       * Since graphs can be deleted but its version could still be referenced somewhere else, we store that information here.
       */
      graphMetadata: GraphMetadata;
      /** Contracts have a direct relationship to the parent schema version that caused it. */
      sourceSchemaVersionId: string | null;
    },
  ) {
    const query = psql`/* insertSchemaVersion */
      INSERT INTO schema_versions
        (
          "record_version",
          "is_composable",
          "target_id",
          "base_schema",
          "has_persisted_schema_changes",
          "previous_schema_version_id",
          "diff_schema_version_id",
          "composite_schema_sdl",
          "supergraph_sdl",
          "supergraph_changes",
          "schema_composition_errors",
          "github_repository",
          "github_sha",
          "tags",
          "has_contract_composition_errors",
          "conditional_breaking_change_metadata",
          "schema_metadata",
          "metadata_attributes",
          "origin",
          "meta",
          "graph_id",
          "graph_metadata",
          "source_schema_version_id"
        )
      VALUES
        (
          '2024-01-10',
          ${args.isComposable},
          ${args.targetId},
          ${args.baseSchema},
          true,
          ${args.previousSchemaVersionId},
          ${args.diffSchemaVersionId},
          ${args.compositeSchemaSDL},
          ${args.supergraphSDL},
          ${psql.jsonbOrNull(args.supergraphChanges?.map(toSerializableSchemaChange))},
          ${psql.jsonbOrNull(args.schemaCompositionErrors)},
          ${args.github?.repository ?? null},
          ${args.github?.sha ?? null},
          ${Array.isArray(args.tags) ? psql.array(args.tags, 'text') : null},
          ${args.hasContractCompositionErrors},
          ${psql.jsonbOrNull(InsertConditionalBreakingChangeMetadataModel.parse(args.conditionalBreakingChangeMetadata))},
          ${psql.jsonbOrNull(args.schemaMetadata)},
          ${psql.jsonbOrNull(args.metadataAttributes)},
          ${psql.jsonb(SchemaVersionOriginModel.parse(args.origin))},
          ${psql.jsonbOrNull(SchemaVersionMetaModel.nullable().parse(args.meta))},
          ${args.graphId},
          ${psql.jsonb(GraphMetadataModel.parse(args.graphMetadata))},
          ${args.sourceSchemaVersionId}
        )
      RETURNING
        ${schemaVersionSQLFields()}
    `;

    return await trx.maybeOne(query).then(SchemaVersionModel.parse);
  }

  private async insertSchemaVersionChanges(
    trx: CommonQueryMethods,
    args: {
      changes: Array<SchemaChangeType>;
      versionId: string;
    },
  ) {
    if (args.changes.length === 0) {
      return;
    }

    await trx.query(psql`/* insertSchemaVersionChanges */
      INSERT INTO schema_version_changes (
        "schema_version_id",
        "change_type",
        "severity_level",
        "meta",
        "is_safe_based_on_usage"
      )
      SELECT * FROM
      ${psql.unnest(
        args.changes.map(change =>
          // Note: change.criticality.level is actually a computed value from meta
          [
            args.versionId,
            change.type,
            change.criticality,
            JSON.stringify(change.meta),
            change.isSafeBasedOnUsage ?? false,
          ],
        ),
        ['uuid', 'text', 'text', 'jsonb', 'bool'],
      )}
    `);
  }

  private async insertPushSchemaLog(
    trx: CommonQueryMethods,
    args: {
      author: string;
      service: string | null;
      url: string | null;
      commit: string;
      schema: string;
      projectId: string;
      metadata: string | null;
      schemaRevisionId: string | null;
    },
  ) {
    const query = psql`/* insertSchemaLog */
      INSERT INTO "schema_log"
        (
          "author",
          "service_name",
          "service_url",
          "commit",
          "sdl",
          "project_id",
          "metadata",
          "schema_revision_id",
          "action"
        )
      VALUES
        (
        ${args.author},
        lower(${args.service}::text),
        ${args.url}::text,
        ${args.commit}::text,
        ${args.schema}::text,
        ${args.projectId},
        ${args.metadata},
        ${args.schemaRevisionId},
        'PUSH'
      )
      RETURNING
        "id"
    `;
    return await trx.maybeOne(query).then(z.object({ id: z.string() }).parse);
  }

  private async insertSchemaVersionContract(
    trx: CommonQueryMethods,
    args: {
      schemaVersionId: string;
      contractId: string;
      contractName: string;
      compositeSchemaSDL: string | null;
      supergraphSDL: string | null;
      schemaCompositionErrors: Array<SchemaCompositionError> | null;
      changes: Array<SchemaChangeType> | null;
      supergraphChanges: Array<SchemaChangeType> | null;
      previousSchemaVersionId: string | null;
      diffSchemaVersionId: string | null;
      graph: Graph;
      origin: SchemaVersionOrigin;
      github: GithubMeta;
      conditionalBreakingChangeMetadata: ConditionalBreakingChangeMetadata | null;
      meta: SchemaVersionMeta | null;
    },
  ): Promise<void> {
    const version = await this.insertSchemaVersion(trx, {
      sourceSchemaVersionId: args.schemaVersionId,
      graphMetadata: {
        id: args.graph.id,
        name: args.graph.name,
        type: 'contract',
      },
      isComposable: !args.schemaCompositionErrors?.length,
      targetId: args.graph.targetId,
      supergraphSDL: args.supergraphSDL,
      compositeSchemaSDL: args.compositeSchemaSDL,
      graphId: args.graph.id,
      hasContractCompositionErrors: false,
      supergraphChanges: args.supergraphChanges,
      meta: args.meta,
      conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
      github: args.github,
      origin: args.origin,
      schemaCompositionErrors: args.schemaCompositionErrors,
      previousSchemaVersionId: args.previousSchemaVersionId,
      diffSchemaVersionId: args.diffSchemaVersionId,
      schemaMetadata: null,
      baseSchema: null,
      tags: null,
      metadataAttributes: null,
    });

    if (args.changes?.length) {
      await this.insertSchemaVersionChanges(trx, {
        changes: args.changes,
        versionId: version.id,
      });
    }
  }

  @traceFn('SchemaVersionsStore.createPublishSchemaVersion', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.organization.id': args.organizationId,
      'hive.project.id': args.projectId,
      'hive.version.commit': args.commit,
      'hive.version.valid': args.valid,
      'hive.version.service': args.service?.name || '',
    }),
  })
  async createPublishSchemaVersion(
    args: {
      schema: string;
      author: string;
      service: {
        name: string;
        url: string;
      } | null;
      metadata: string | null;
      valid: boolean;
      commit: string;
      existingSchemaLogs: Array<{ id: string; serviceName: string | null }>;
      base_schema: string | null;
      actionFn(versionId: string): Promise<void>;
      changes: Array<SchemaChangeType>;
      previousSchemaVersion: null | string;
      /** The ID of the previous schema log for the same service. */
      previousSchemaLogId: string | null;
      serviceChanges: null | Array<SchemaChangeType>;
      diffSchemaVersionId: null | string;
      github: null | {
        repository: string;
        sha: string;
      };
      contracts: null | Array<CreateContractVersionInput>;
      conditionalBreakingChangeMetadata: null | ConditionalBreakingChangeMetadata;
      targetId: string;
      projectId: string;
      organizationId: string;
      schemaRevisionId: string | null;
      revision: string | null;
      graph: Pick<Graph, 'id' | 'name'>;
    } & (
      | {
          compositeSchemaSDL: null;
          supergraphSDL: null;
          supergraphChanges: null;
          schemaCompositionErrors: Array<SchemaCompositionError>;
          tags: null;
          schemaMetadata: null;
          metadataAttributes: null;
        }
      | {
          compositeSchemaSDL: string;
          supergraphSDL: string | null;
          supergraphChanges: Array<SchemaChangeType> | null;
          schemaCompositionErrors: null;
          tags: null | Array<string>;
          schemaMetadata: null | Record<
            string,
            Array<{ name: string; content: string; source: string | null }>
          >;
          metadataAttributes: null | Record<string, string[]>;
        }
    ),
  ): Promise<SchemaVersion> {
    this.logger.info(
      'Creating a new version (input=%o)',
      lodash.pick(args, [
        'commit',
        'author',
        'valid',
        'service',
        'logIds',
        'url',
        'previousSchemaVersion',
        'diffSchemaVersionId',
        'github',
        'conditionalBreakingChangeMetadata',
      ]),
    );

    const output = await this.pg.transaction('createPublishSchemaVersion', async trx => {
      if (args.schemaRevisionId) {
        const isMarked = await SchemaRevisionStore.markPublished(args.schemaRevisionId, trx);
        if (!isMarked) {
          throw new SchemaRevisionUnavailableError();
        }
      }

      const newLog = await this.insertPushSchemaLog(trx, {
        author: args.author,
        commit: args.commit,
        metadata: args.metadata,
        projectId: args.projectId,
        schema: args.schema,
        service: args.service?.name ?? null,
        url: args.service?.url ?? null,
        schemaRevisionId: args.schemaRevisionId,
      });

      const origin: SchemaVersionOriginPublish = {
        type: 'publish',
        revision: args.service ? null : args.revision,
        services: args.service
          ? [
              {
                name: args.service.name,
                versionId: newLog.id,
                revision: args.revision,
              },
            ]
          : null,
      };

      const meta: SchemaVersionMeta = {
        author: args.author,
        commit: args.commit,
      };

      // creates a new version
      const version = await this.insertSchemaVersion(trx, {
        isComposable: args.valid,
        targetId: args.targetId,
        graphId: args.graph.id,
        graphMetadata: {
          id: args.graph.id,
          name: args.graph.name,
          type: 'default',
        },
        sourceSchemaVersionId: null,
        origin,
        baseSchema: args.base_schema,
        previousSchemaVersionId: args.previousSchemaVersion,
        diffSchemaVersionId: args.diffSchemaVersionId,
        compositeSchemaSDL: args.compositeSchemaSDL,
        supergraphSDL: args.supergraphSDL,
        supergraphChanges: args.supergraphChanges,
        schemaCompositionErrors: args.schemaCompositionErrors,
        github: args.github,
        meta,
        tags: args.tags,
        schemaMetadata: args.schemaMetadata,
        metadataAttributes: args.metadataAttributes,
        hasContractCompositionErrors:
          args.contracts?.some(c => c.schemaCompositionErrors != null) ?? false,
        conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
      });

      await trx.query(psql`/* insertSchemaVersionToLog */
        INSERT INTO "schema_version_to_log" (
          "version_id"
          , "action_id"
          , "type"
          , "previous_action_id"
          , "schema_changes"
          , "subgraph_name"
        )
        SELECT * FROM
          ${psql.unnest(
            args.existingSchemaLogs
              .concat({
                id: newLog.id,
                serviceName: args.service?.name ?? null,
              })
              .map(log => [
                version.id,
                log.id,
                log.id !== newLog.id ? 'unchanged' : args.previousSchemaLogId ? 'changed' : 'added',
                log.id === newLog.id ? args.previousSchemaLogId : null,
                log.id === newLog.id
                  ? (JSON.stringify(args.serviceChanges?.map(toSerializableSchemaChange)) ?? null)
                  : null,
                log.serviceName,
              ]),
            ['uuid', 'uuid', 'hive_subgraph_log_type', 'uuid', 'jsonb', 'text'],
          )}
      `);

      await this.insertSchemaVersionChanges(trx, {
        versionId: version.id,
        changes: args.changes,
      });

      for (const contract of args.contracts ?? []) {
        await this.insertSchemaVersionContract(trx, {
          schemaVersionId: version.id,
          changes: contract.changes,
          contractId: contract.contractId,
          contractName: contract.contractName,
          schemaCompositionErrors: contract.schemaCompositionErrors,
          compositeSchemaSDL: contract.compositeSchemaSDL,
          supergraphSDL: contract.supergraphSDL,
          graph: contract.graph,
          origin,
          github: args.github,
          supergraphChanges: contract.supergraphChanges,
          conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
          diffSchemaVersionId: contract.diffSchemaVersionId,
          previousSchemaVersionId: contract.previousSchemaVersionId,
          meta,
        });
      }

      await args.actionFn(version.id);

      return {
        version,
        log: newLog,
      };
    });

    return output.version;
  }

  async deleteSubgraphFromGraph(
    graph: Graph,
    args: {
      service: {
        name: string;
        versionId: string;
      };
      composable: boolean;
      actionFn(versionId: string): Promise<void>;
      changes: Array<SchemaChangeType> | null;
      diffSchemaVersionId: string | null;
      conditionalBreakingChangeMetadata: null | ConditionalBreakingChangeMetadata;
      contracts: null | Array<CreateContractVersionInput>;
    } & (
      | {
          compositeSchemaSDL: null;
          supergraphSDL: null;
          supergraphChanges: null;
          schemaCompositionErrors: Array<SchemaCompositionError>;
          tags: null;
          schemaMetadata: null;
          metadataAttributes: null;
        }
      | {
          compositeSchemaSDL: string;
          supergraphSDL: string | null;
          supergraphChanges: Array<SchemaChangeType> | null;
          schemaCompositionErrors: null;
          tags: null | Array<string>;
          schemaMetadata: null | Record<
            string,
            Array<{ name: string; content: string; source: string | null }>
          >;
          metadataAttributes: null | Record<string, string[]>;
        }
    ),
  ) {
    return this.pg.transaction('deleteSubgraphFromGraph', async trx => {
      // fetch the latest version
      const latestVersion = await trx
        .maybeOne(
          psql`/* findLatestSchemaVersion */
          SELECT
            "id"
            , "base_schema" AS "baseSchema"
          FROM
            "schema_versions"
          WHERE
            (
              "graph_id" = ${graph.id}
              ${
                graph.isBackfilled
                  ? psql`
                    OR (
                      "target_id" = ${graph.targetId}
                      AND "graph_metadata" IS NULL
                    )
                  `
                  : psql``
              }
            )
          ORDER BY
            "created_at" DESC
          LIMIT 1
        `,
        )
        .then(z.object({ id: z.string(), baseSchema: z.string().nullable() }).parse);

      // create a new action
      const deleteActionResult = await trx
        .maybeOne(
          psql`/* createDeleteActionSchemaLog */
          INSERT INTO schema_log
            (
              "author",
              "commit",
              "service_name",
              "project_id",
              "action"
            )
          VALUES
            (
              ${'system'}::text,
              ${'system'}::text,
              lower(${args.service.name}::text),
              ${graph.projectId},
              'DELETE'
            )
          RETURNING
            id
            , "author"
            , "commit"
            , to_json("created_at") AS "createdAt"
            , "service_name" AS "serviceName"
        `,
        )
        .then(
          z.object({
            id: z.string(),
            author: z.string(),
            commit: z.string(),
            createdAt: z.string(),
            serviceName: z.string(),
          }).parse,
        );

      const origin: SchemaVersionOriginDelete = {
        type: 'delete',
        services: [{ name: args.service.name, versionId: args.service.versionId }],
      };

      // creates a new version
      const newVersion = await this.insertSchemaVersion(trx, {
        isComposable: args.composable,
        targetId: graph.targetId,
        origin,
        baseSchema: latestVersion.baseSchema,
        previousSchemaVersionId: latestVersion.id,
        diffSchemaVersionId: args.diffSchemaVersionId,
        compositeSchemaSDL: args.compositeSchemaSDL,
        supergraphSDL: args.supergraphSDL,
        supergraphChanges: args.supergraphChanges,
        schemaCompositionErrors: args.schemaCompositionErrors,
        // Deleting a schema is done via CLI and not associated to a commit or a pull request.
        github: null,
        meta: null,
        tags: args.tags,
        schemaMetadata: args.schemaMetadata,
        metadataAttributes: args.metadataAttributes,
        hasContractCompositionErrors:
          args.contracts?.some(c => c.schemaCompositionErrors != null) ?? false,
        conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
        graphId: graph.id,
        graphMetadata: { id: graph.id, name: graph.name, type: 'default' },
        sourceSchemaVersionId: null,
      });

      // Move all the schema_version_to_log entries of the previous version to the new version
      await trx.query(psql`/* moveSchemaVersionToLog */
        INSERT INTO schema_version_to_log (
          version_id
          , action_id
          , type
          , subgraph_name
        )
        SELECT
          ${newVersion.id}::uuid as version_id
          , svl.action_id as action_id
          , 'unchanged'
          , sl.service_name as subgraph_name
        FROM schema_version_to_log svl
        LEFT JOIN schema_log sl ON (sl.id = svl.action_id)
        WHERE svl.version_id = ${latestVersion.id} AND sl.action = 'PUSH' AND lower(sl.service_name) != lower(${args.service.name})
      `);

      await trx.query(psql`/* insertSchemaVersionToLog */
        INSERT INTO schema_version_to_log
          ("version_id", "action_id", "type", "previous_action_id", "subgraph_name")
        VALUES
          (${newVersion.id}, ${deleteActionResult.id}, 'removed', ${args.service.versionId}, lower(${args.service.name}))
      `);

      if (args.changes != null) {
        await this.insertSchemaVersionChanges(trx, {
          versionId: newVersion.id,
          changes: args.changes,
        });
      }

      for (const contract of args.contracts ?? []) {
        await this.insertSchemaVersionContract(trx, {
          schemaVersionId: newVersion.id,
          contractId: contract.contractId,
          contractName: contract.contractName,
          schemaCompositionErrors: contract.schemaCompositionErrors,
          compositeSchemaSDL: contract.compositeSchemaSDL,
          supergraphSDL: contract.supergraphSDL,
          changes: contract.changes,
          graph: contract.graph,
          origin,
          github: null,
          supergraphChanges: contract.supergraphChanges,
          conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
          diffSchemaVersionId: contract.diffSchemaVersionId,
          previousSchemaVersionId: contract.previousSchemaVersionId,
          meta: null,
        });
      }

      await args.actionFn(newVersion.id);

      return {
        kind: 'composite',
        id: deleteActionResult.id,
        date: deleteActionResult.createdAt as any,
        service_name: deleteActionResult.serviceName,
        action: 'DELETE',
        versionId: newVersion.id,
        author: deleteActionResult.author,
        commit: deleteActionResult.commit,
      } satisfies CompositeDeletedSchemaLog & {
        versionId: string;
      };
    });
  }

  async countSchemaVersionsOfDefaultGraphsInProject(
    project: Project,
    period: {
      from: Date;
      to: Date;
    } | null,
  ): Promise<number> {
    const periodFilter = period
      ? psql`
          AND sv.created_at >= ${period.from.toISOString()}
          AND sv.created_at < ${period.to.toISOString()}
        `
      : psql``;

    const result = await this.pg
      .maybeOne(
        psql`/* countPeriodSchemaVersionsOfProject */
          SELECT
            COUNT(*) as "total"
          FROM
            "schema_versions" as sv
          INNER JOIN
            "targets" as t ON (t."id" = sv."target_id")
          WHERE
            t."project_id" = ${project.id}
            AND (
              ${
                /* Legacy Records */ psql`
                  sv."graph_metadata" IS NULL
                `
              }
              OR
              ${
                /* New "default" graph records */ psql`
                (
                  sv."graph_metadata"->>'name' = 'default'
                  AND sv."graph_metadata"->>'type' = 'default'
                )`
              }
            )
            ${periodFilter}
          `,
      )
      .then(z.object({ total: z.number() }).nullable().parse);

    return result?.total ?? 0;
  }

  async countSchemaVersionsOfTarget(
    graph: Graph,
    period: {
      from: Date;
      to: Date;
    } | null,
  ): Promise<number> {
    const graphFilter = psql`
      (
        "graph_id" = ${graph.id}
         ${
           graph.isBackfilled
             ? psql`
                 OR (
                   "target_id" = ${graph.targetId}
                   AND "graph_metadata" IS NULL
                 )
              `
             : psql``
         }
      )
    `;

    const periodFilter = period
      ? psql`
          AND "created_at" >= ${period.from.toISOString()}
          AND "created_at" < ${period.to.toISOString()}
        `
      : psql``;

    const result = await this.pg
      .maybeOne(
        psql`/* countPeriodSchemaVersionsOfTarget */
          SELECT
            COUNT(*) as "total"
          FROM
            "schema_versions"
          WHERE
            ${graphFilter}
            ${periodFilter}
        `,
      )
      .then(z.object({ total: z.number() }).nullable().parse);

    return result?.total ?? 0;
  }

  async anyVersionExistsForGraph(graph: Graph) {
    return this.pg.exists(
      psql`/* hasSchema */
        SELECT
          1
        FROM
          "schema_versions" as "v"
        WHERE
          (
            "v"."graph_id" = ${graph.id}
            ${
              graph.isBackfilled
                ? psql`
                  OR (
                    "v"."target_id" = ${graph.targetId}
                    AND "v"."graph_metadata" IS NULL
                  )
                `
                : psql``
            }
          )
        LIMIT 1
      `,
    );
  }

  async getMaybeLatestValidSchemaVersionForGraph(graph: Graph): Promise<SchemaVersion | null> {
    let version = await this.pg.maybeOne(
      psql`/* getLatestValidVersion */
        SELECT
          ${schemaVersionSQLFields(psql`"sv".`)}
        FROM
          "schema_versions" as "sv"
        WHERE
          "sv"."graph_id" = ${graph.id}
          AND "sv"."is_composable" IS TRUE
        ORDER BY
          "sv"."created_at" DESC
        LIMIT 1
      `,
    );

    if (!graph.isBackfilled || version) {
      return SchemaVersionModel.nullable().parse(version);
    }

    version = await this.pg.maybeOne(
      psql`/* getLatestValidVersion */
        SELECT
          ${schemaVersionSQLFields(psql`"sv".`)}
        FROM
          "schema_versions" as "sv"
        WHERE
          "sv"."target_id" = ${graph.targetId}
          AND "sv"."is_composable" IS TRUE
          AND "sv"."graph_metadata" IS NULL
        ORDER BY
          "sv"."created_at" DESC
        LIMIT 1
      `,
    );

    return SchemaVersionModel.nullable().parse(version);
  }

  async getLatestValidSchemaVersionForGraph(graph: Graph): Promise<SchemaVersion> {
    const version = await this.getMaybeLatestValidSchemaVersionForGraph(graph);
    invariant(version, 'Expected version to exist.');
    return version;
  }

  async getMaybeLatestSchemaVersionForGraph(graph: Graph): Promise<SchemaVersion | null> {
    let version = await this.pg.maybeOne(
      psql`/* getMaybeLatestVersion */
        SELECT
          ${schemaVersionSQLFields(psql`sv.`)}
        FROM
          "schema_versions" AS "sv"
        WHERE
          "sv"."graph_id" = ${graph.id}
        ORDER BY
          "sv"."created_at" DESC
        LIMIT 1
      `,
    );

    if (version || !graph.isBackfilled) {
      return SchemaVersionModel.nullable().parse(version);
    }

    version = await this.pg.maybeOne(
      psql`/* getMaybeLatestVersion */
        SELECT
          ${schemaVersionSQLFields(psql`sv.`)}
        FROM
          "schema_versions" AS "sv"
        WHERE
          "sv"."target_id" = ${graph.targetId}
          AND "sv"."graph_metadata" IS NULL
        ORDER BY
          "sv"."created_at" DESC
        LIMIT 1
      `,
    );

    return SchemaVersionModel.nullable().parse(version);
  }

  async getSchemaVersionBeforeSchemaVersion(
    schemaVersion: SchemaVersion,
    /** whether to retrieve the previous composable version or not. */
    onlyComposable: boolean,
  ) {
    // shortcut without an index scan
    if (schemaVersion.recordVersion === '2024-01-10') {
      if (onlyComposable && schemaVersion.diffSchemaVersionId) {
        return this.getSchemaVersionById(schemaVersion.diffSchemaVersionId);
      }

      if (!onlyComposable && schemaVersion.previousSchemaVersionId) {
        return this.getSchemaVersionById(schemaVersion.previousSchemaVersionId);
      }

      return null;
    }

    const version = await this.pg.maybeOne(
      psql`/* getVersionBeforeVersionId */
        SELECT
          ${schemaVersionSQLFields()}
        FROM "schema_versions"
        WHERE
          "target_id" = ${schemaVersion.targetId}
          AND (
            (
              "created_at" = ${schemaVersion.createdAt}
              AND "id" < ${schemaVersion.id}
            )
            OR "created_at" < ${schemaVersion.createdAt}
          )
          ${onlyComposable ? psql`AND "is_composable" = TRUE` : psql``}
        ORDER BY
          "created_at" DESC
        LIMIT 1
      `,
    );

    return SchemaVersionModel.nullable().parse(version);
  }

  async getSchemaForSchemaVersionIdAndName(schemaVersionId: string, serviceName: string) {
    return this.pg
      .maybeOne(
        psql`/* getSchemaByNameOfVersion */
          SELECT
            ${schemaLogFields(psql`sl.`)}
            , p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${schemaVersionId}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
            AND lower(sl.service_name) = lower(${serviceName})
          ORDER BY
            sl.created_at DESC
        `,
      )
      .then(SchemaPushLogModel.nullable().parse);
  }

  async getSchemasBySchemaVersionId(schemaVersionId: string) {
    return this.pg
      .any(
        psql`/* getSchemasOfVersion */
          SELECT
            ${schemaLogFields(psql`sl.`)}
            , p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${schemaVersionId}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
          ORDER BY
            sl.created_at DESC
        `,
      )
      .then(z.array(SchemaPushLogModel).parse);
  }

  async getServiceNamesBySchemaVersionId(schemaVersionId: string) {
    return this.pg
      .anyFirst(
        psql`/* getServiceNamesOfVersion */
          SELECT
            lower(sl.service_name) AS service_name
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects AS p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${schemaVersionId}
            AND sl.action = 'PUSH'
            AND sl.service_name IS NOT NULL
            AND p.type != 'CUSTOM'
          ORDER BY
            lower(sl.service_name) ASC
        `,
      )
      .then(z.array(z.string()).parse);
  }

  async getSchemaRevisionsBySchemaLogIds(schemaLogIds: Array<string>) {
    if (schemaLogIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await this.pg.any(psql`/* getSchemaRevisionsBySchemaLogIds */
      SELECT
        "schema_log"."id" AS "schemaLogId"
        , "schema_revisions"."revision"
      FROM
        "schema_log"
      INNER JOIN
        "schema_revisions"
      ON
        "schema_revisions"."id" = "schema_log"."schema_revision_id"
      WHERE
        "schema_log"."id" = ANY(${psql.array(schemaLogIds, 'uuid')})
    `);

    return new Map(
      z
        .array(z.object({ schemaLogId: z.string(), revision: z.string() }))
        .parse(rows)
        .map(row => [row.schemaLogId, row.revision]),
    );
  }

  async getServiceSchemaOfVersion(schemaVersion: SchemaVersion, serviceName: string) {
    return this.pg
      .maybeOne(
        psql`/* getServiceSchemaOfVersion */
          SELECT
            ${schemaLogFields(psql`sl.`)}
            , p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${schemaVersion.id}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
            AND lower(sl.service_name) = lower(${serviceName})
      `,
      )
      .then(SchemaPushLogModel.nullable().parse);
  }

  async getSchemaVersionForGraphById(
    graph: Graph,
    schemaVersionId: string,
  ): Promise<SchemaVersion | null> {
    const schemaVersion = await this.getSchemaVersionById(schemaVersionId);

    if (
      schemaVersion &&
      // Graph ID match
      (schemaVersion.graphId === graph.id ||
        // legacy match
        (graph.isBackfilled &&
          schemaVersion.graphMetadata === null &&
          schemaVersion.targetId === graph.targetId))
    ) {
      return schemaVersion;
    }

    return null;
  }

  async getSchemaVersionById(schemaVersionId: string) {
    const result = await this.pg.maybeOne(psql`/* getMaybeVersion */
      SELECT
        ${schemaVersionSQLFields(psql`sv.`)}
      FROM schema_versions as sv
      WHERE
        sv.id = ${schemaVersionId}
      LIMIT 1
    `);

    return SchemaVersionModel.nullable().parse(result);
  }

  /**
   * Retrieve the paginated schema versions for a graph.
   * Handles legacy schema version records that do not have a `graph_id` populated.
   */
  async getPaginatedSchemaVersionsForGraph(
    graph: Graph,
    args: {
      first: number | null;
      cursor: null | string;
    },
  ) {
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.cursor ? decodeCreatedAtAndUUIDIdBasedCursor(args.cursor) : null;

    const cursorCondition = cursor
      ? psql`
        AND (
          (
            "created_at" = ${cursor.createdAt}
            AND "id" < ${cursor.id}
          )
          OR "created_at" < ${cursor.createdAt}
        )
      `
      : psql``;

    const graphVersions = psql`
      SELECT
        *
      FROM
        "schema_versions"
      WHERE
        "graph_id" = ${graph.id}
        ${cursorCondition}
      ORDER BY
        "created_at" DESC
        , "id" DESC
      LIMIT ${limit + 1}
    `;

    // Each branch is served by its own (graph_id | target_id, created_at, id) index, so the union
    // reads at most 2 * (limit + 1) rows instead of sorting every version of the target.
    const result = await this.pg.any(psql`/* getPaginatedSchemaVersionsForGraph */
      SELECT
        ${schemaVersionSQLFields()}
      FROM (
        ${
          graph.isBackfilled
            ? psql`
              (${graphVersions})
              UNION ALL
              (
                SELECT
                  *
                FROM
                  "schema_versions"
                WHERE
                  "target_id" = ${graph.targetId}
                  AND "graph_metadata" IS NULL
                  ${cursorCondition}
                ORDER BY
                  "created_at" DESC
                  , "id" DESC
                LIMIT ${limit + 1}
              )
            `
            : graphVersions
        }
      ) AS "schema_versions"
      ORDER BY
        "created_at" DESC
        , "id" DESC
      LIMIT ${limit + 1}
    `);

    let nodes = z.array(SchemaVersionModel).parse(result);

    const hasNextPage = nodes.length > limit;
    nodes = nodes.slice(0, limit);

    const edges = nodes.map(node => ({
      node,
      get cursor() {
        return encodeCreatedAtAndUUIDIdBasedCursor(node);
      },
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        get endCursor() {
          return edges[edges.length - 1]?.cursor ?? '';
        },
        get startCursor() {
          return edges[0]?.cursor ?? '';
        },
      },
    };
  }

  async getSchemaSchangesForSchemaVersion(schemaVersion: SchemaVersion) {
    const changes = await this.pg
      .any(
        psql`/* getSchemaChangesForVersion */
          SELECT
            "change_type" as "type",
            "meta",
            "severity_level" as "severityLevel",
            "is_safe_based_on_usage" as "isSafeBasedOnUsage"
          FROM
            "schema_version_changes"
          WHERE
            "schema_version_id" = ${schemaVersion.id}
    `,
      )
      .then(z.array(HiveSchemaChangeModel).parse);

    if (changes.length === 0) {
      return null;
    }

    return changes;
  }

  async getSchemaVersionForGraphByCommit(graph: Graph, commit: string) {
    const record = await this.pg.maybeOne(psql`/* getSchemaVersionByCommit */
      SELECT
        ${schemaVersionSQLFields()}
      FROM
        "schema_versions"
      WHERE
        (
          "graph_id" = ${graph.id}
          ${
            graph.isBackfilled
              ? psql`
                  OR (
                    "target_id" = ${graph.targetId}
                    AND "graph_metadata" IS NULL
                  )
                `
              : psql``
          }
        )
        AND (
          "meta"->>'commit' = ${commit}
          OR "action_id" = ANY(
            SELECT
              "id"
            FROM
              "schema_log"
            WHERE
              "schema_log"."project_id" = ${graph.projectId}
              AND "schema_log"."commit" = ${commit}
            ORDER BY "schema_log"."created_at" DESC
          )
        )
      ORDER BY
        "target_id"
        , "created_at" DESC
      LIMIT 1
    `);

    return SchemaVersionModel.nullable().parse(record);
  }

  getSchemaLogById = batch<string, SchemaLog>(async schemaLogIds => {
    const rows = await this.pg.any(
      psql`/* getSchemaLog */
          SELECT
            ${schemaLogFields(psql`sl.`)}
            , p.type
          FROM schema_log as sl
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE sl.id = ANY(${psql.array(schemaLogIds, 'uuid')})
      `,
    );
    const schemas = z.array(SchemaLogModel).parse(rows);

    return schemaLogIds.map(schemaLogId => {
      const schema = schemas.find(row => row.id === schemaLogId);

      if (schema) {
        return Promise.resolve(schema);
      }

      return Promise.reject(new Error(`Schema log not found (schemaLogId=${schemaLogId})`));
    });
  });

  async getMatchingServiceSchemaOfVersions(versions: { before: string | null; after: string }) {
    const after = await this.pg
      .maybeOne(
        psql`/* getMatchingServiceSchemaOfVersions */
        SELECT sl.service_name, sl.sdl
        FROM schema_versions as sv
        LEFT JOIN schema_log as sl ON sv.action_id = sl.id
        WHERE sv.id = ${versions.after} AND service_name IS NOT NULL
      `,
      )
      .then(z.object({ service_name: z.string(), sdl: z.string() }).parse);

    // It's an initial version, so we just need to fetch a single version
    if (!versions.before) {
      return { serviceName: after.service_name, after: after.sdl, before: null };
    }

    const before = await this.pg
      .maybeOne(
        psql`/* getMatchingServiceSchemaOfVersions */
        SELECT sl.sdl
        FROM schema_version_to_log as svtl
        LEFT JOIN schema_log as sl ON svtl.action_id = sl.id
        WHERE svtl.version_id = ${versions.before} AND sl.service_name = ${after.service_name}
      `,
      )
      .then(z.object({ sdl: z.string().nullable() }).nullable().parse);

    return { serviceName: after.service_name, after: after.sdl, before: before?.sdl ?? null };
  }

  private getRawSchemaLogEdgesForSchemaVersionId = batch<string, Array<RawSchemaLogEdge>>(
    async schemaVersionIds => {
      const edgesQuery = psql`
        SELECT
          ${schemaLogEdgesFields()}
        FROM
          "schema_version_to_log"
        WHERE
          "version_id" = ANY(${psql.array(schemaVersionIds, 'uuid')})
      `;

      const rows = await this.pg.any(edgesQuery);

      const edgesBySchemaVersionId = new Map<string, Array<RawSchemaLogEdge>>();

      for (const row of rows) {
        const edge = RawSchemaLogEdgeModel.parse(row);
        let edges = edgesBySchemaVersionId.get(edge.schemaVersionId);
        if (!Array.isArray(edges)) {
          edges = [];
          edgesBySchemaVersionId.set(edge.schemaVersionId, edges);
        }
        edges.push(edge);
      }

      return schemaVersionIds.map(
        async schemaVersionId => edgesBySchemaVersionId.get(schemaVersionId) ?? [],
      );
    },
  );

  private _getSchemaLogNodeByNodeId = batch<string, SchemaLog>(async nodeIds => {
    const rows = await this.pg.any(
      psql`/* getSchemaLog */
        SELECT
          ${schemaLogFields(psql`sl.`)}
          , p.type
        FROM schema_log as sl
          LEFT JOIN projects as p ON (p.id = sl.project_id)
        WHERE
          sl.id = ANY(${psql.array(nodeIds, 'uuid')})
      `,
    );

    const nodeByNodeId = new Map<string, SchemaLog>();

    for (const row of rows) {
      const node = SchemaLogModel.parse(row);
      nodeByNodeId.set(node.id, node);
    }

    return nodeIds.map(async nodeId => {
      const node = nodeByNodeId.get(nodeId);
      if (!node) {
        throw new Error(`Invariant: Could not resolve node with id '${nodeId}'.`);
      }
      return node;
    });
  });

  @cache<string>(nodeId => nodeId)
  getSchemaLogNodeByNodeId(nodeId: string): Promise<SchemaLog> {
    return this._getSchemaLogNodeByNodeId(nodeId);
  }

  /**
   * Retrieve the schema log edges and nodes.
   * Handles legacy database records gracefully.
   */
  @cache<SchemaVersion>(schemaVersion => schemaVersion.id)
  async getSchemaLogEdgesWithNodesForSchemaVersion(
    schemaVersion: SchemaVersion,
  ): Promise<Array<SchemaLogWithEdges>> {
    this.logger.debug(
      'Retrieve schema log edges with nodes for schema version. (schemaVersionId=%s)',
      schemaVersion.id,
    );

    const edges = await this.getRawSchemaLogEdgesForSchemaVersionId(schemaVersion.id);
    const nodeIds = edges.map(edge => edge.actionId);

    const nodes = await Promise.all(nodeIds.map(nodeId => this.getSchemaLogNodeByNodeId(nodeId)));
    const nodesById = new Map(nodes.map(node => [node.id, node] as const));

    const edgesWithNodes: Array<SchemaLogWithEdges> = [];

    for (const edge of edges) {
      const node = nodesById.get(edge.actionId);
      invariant(node, `Could not resolve node with id '${edge.actionId}' for edge.`);

      if (edge.type !== null) {
        edgesWithNodes.push(
          SchemaLogWithEdgesModel.parse({
            ...edge,
            node,
          }),
        );
        continue;
      }

      this.logger.debug(
        'Processing and computing legacy edge. (schemaVersionId=%s, schemaLogId=%s)',
        schemaVersion.id,
        node.id,
      );

      // Legacy case: We need to produce the edge by looking at the node and previous schema version
      // In legacy versions a PUSH and DELETE action can be identified by looking at the `actionId`

      invariant(
        schemaVersion.actionId,
        `The schema version '${schemaVersion.id}' without actionId should not have an edge without a type.`,
      );

      // if the actionId does not match the node, we have a unchanged edge
      if (schemaVersion.actionId !== node.id) {
        invariant(node.action !== 'DELETE', ` The action can not be delete in this scenario.`);

        edgesWithNodes.push({
          type: 'unchanged',
          subgraphName: node.service_name,
          schemaChanges: null,
          previousActionId: null,
          actionId: node.id,
          schemaVersionId: edge.schemaVersionId,
          node,
        });
        continue;
      }

      // We now need the previous schema version to determine whether a edge is a "delete", "added" or "changed" action

      const previousSchemaVersion = await this.getSchemaVersionBeforeSchemaVersion(
        schemaVersion,
        false,
      );

      // if no previous schema version exists this is the initial one and we have an "added" action
      if (!previousSchemaVersion) {
        invariant(node.action !== 'DELETE', `The action can not be delete in this scenario.`);

        edgesWithNodes.push({
          type: 'added',
          subgraphName: node.service_name,
          schemaChanges: null,
          previousActionId: null,
          actionId: node.id,
          schemaVersionId: edge.schemaVersionId,
          node,
        });
        continue;
      }

      // if there is no service name, this is always a "changed" event
      // as we only have a "single" subgraph
      if (!node.service_name) {
        if (node.kind !== 'single') {
          throw new Error(`Invariant: The action can only be a single schema.`);
        }

        invariant(
          previousSchemaVersion.actionId,
          `The schema version '${previousSchemaVersion.id}' should have a 'actionId' property.`,
        );

        edgesWithNodes.push({
          type: 'changed',
          subgraphName: null,
          schemaChanges: null,
          previousActionId: previousSchemaVersion.actionId,
          actionId: node.id,
          schemaVersionId: edge.schemaVersionId,
          node,
        });
        continue;
      }

      const previousNode = await this.getServiceSchemaOfVersion(
        previousSchemaVersion,
        node.service_name,
      );

      // if the node action is push, we have either a changed or added edge - depending on whether a schema log exists within the previous schema version...
      if (node.action === 'PUSH') {
        if (previousNode) {
          edgesWithNodes.push({
            type: 'changed',
            subgraphName: node.service_name,
            schemaChanges: null,
            previousActionId: previousNode.id,
            actionId: node.id,
            schemaVersionId: edge.schemaVersionId,
            node,
          });
          continue;
        }

        // if there is no log in the previous schema version, we have an "added" event
        edgesWithNodes.push({
          type: 'added',
          subgraphName: node.service_name,
          schemaChanges: null,
          previousActionId: null,
          actionId: node.id,
          schemaVersionId: edge.schemaVersionId,
          node,
        });
        continue;
      }

      if (node.action === 'DELETE') {
        invariant(
          previousNode,
          `This should never happen. A 'DELETE' node can exist only if the node existed in the previous version.`,
        );

        // if the node action is DELETE we have a removal edge
        edgesWithNodes.push({
          type: 'removed',
          subgraphName: node.service_name,
          schemaChanges: null,
          previousActionId: previousNode.id,
          actionId: node.id,
          schemaVersionId: edge.schemaVersionId,
          node,
        });
        continue;
      }

      invariant(previousNode, `All node action cases exhausted.`);
    }

    return edgesWithNodes;
  }

  async createPromotionSchemaVersion(args: {
    /** Where is this version promoted to? */
    origin: {
      version: SchemaVersion;
      target: Target;
      graph: Graph;
      /** Because of legacy schema versions we cannot rely on the value on the version itself. */
      publicSchemaSdl: string | null;
      /** Because of legacy schema versions we cannot rely on the value on the version itself. */
      supergraphSdl: string | null;
    };
    target: {
      target: Target;
      graph: Graph;
      latestVersion: SchemaVersion | null;
      latestValidVersion: SchemaVersion | null;
    };
    meta: SchemaVersionMeta | null;
    schemaLogs: SchemaLogDiffInput;
    publicSchemaChanges: Array<SchemaChangeType> | null;
    supergraphSchemaChanges: Array<SchemaChangeType> | null;
    contracts: null | Array<CreateContractVersionInput>;
    conditionalBreakingChangeMetadata: null | ConditionalBreakingChangeMetadata;
  }) {
    return await this.pg.transaction('createPromotionSchemaVersion', async trx => {
      const origin: SchemaVersionOriginPromotion = {
        type: 'promotion',
        source: {
          schemaVersion: { id: args.origin.version.id },
          target: { id: args.origin.target.id, name: args.origin.target.name },
          graph: { id: args.origin.graph.id, name: args.origin.graph.name },
        },
      };

      const schemaVersion = await this.insertSchemaVersion(trx, {
        isComposable: args.origin.version.isComposable,
        targetId: args.target.target.id,
        origin,
        baseSchema: args.origin.version.baseSchema,
        previousSchemaVersionId: args.target.latestVersion?.id ?? null,
        diffSchemaVersionId: args.target.latestValidVersion?.id ?? null,
        compositeSchemaSDL: args.origin.publicSchemaSdl,
        supergraphSDL: args.origin.supergraphSdl,
        supergraphChanges: args.supergraphSchemaChanges,
        schemaCompositionErrors: args.origin.version.schemaCompositionErrors,
        github: args.origin.version.github,
        meta: args.meta,
        tags: args.origin.version.tags,
        schemaMetadata: args.origin.version.schemaMetadata,
        metadataAttributes: args.origin.version.metadataAttributes,
        hasContractCompositionErrors:
          args.contracts?.some(c => c.schemaCompositionErrors != null) ?? false,
        conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
        graphId: args.target.graph.id,
        graphMetadata: { id: args.target.graph.id, name: args.target.graph.name, type: 'default' },
        sourceSchemaVersionId: null,
      });

      if (args.publicSchemaChanges?.length) {
        await this.insertSchemaVersionChanges(trx, {
          changes: args.publicSchemaChanges,
          versionId: schemaVersion.id,
        });
      }

      if (args.schemaLogs.removed.length) {
        // Insert new nodes
        const insertDeleteSchemaLogsQuery = psql` /* insertDeleteSchemaLogs */
          INSERT INTO "schema_log" (
            "id"
            , "project_id"
            , "target_id"
            , "author"
            , "commit"
            , "service_name"
            , "action"
          )
          SELECT * FROM ${psql.unnest(
            args.schemaLogs.removed.map(log => [
              log.id,
              log.projectId,
              log.targetId,
              'system',
              'system',
              log.serviceName,
              'DELETE',
            ]),
            ['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text'],
          )}
        `;

        await trx.query(insertDeleteSchemaLogsQuery);
      }

      // Insert new edges
      if (
        args.schemaLogs.added.length ||
        args.schemaLogs.changed.length ||
        args.schemaLogs.removed.length ||
        args.schemaLogs.unchanged.length
      ) {
        const insertAddedAndChangedSchemaLogEdges = psql` /* insertAddedAndChangedSchemaLogEdges */
          INSERT INTO "schema_version_to_log" (
            "version_id"
            , "action_id"
            , "type"
            , "previous_action_id"
            , "schema_changes"
            , "subgraph_name"
          )
          SELECT * FROM ${psql.unnest(
            args.schemaLogs.removed
              .map(log => [
                schemaVersion.id,
                log.id,
                log.type,
                log.previousId,
                null,
                log.serviceName,
              ])
              .concat(
                args.schemaLogs.changed.map(log => [
                  schemaVersion.id,
                  log.id,
                  log.type,
                  log.previousId,
                  JSON.stringify(log.changes?.map(toSerializableSchemaChange)) ?? null,
                  log.serviceName,
                ]),
              )
              .concat(
                args.schemaLogs.added.map(log => [
                  schemaVersion.id,
                  log.id,
                  log.type,
                  null,
                  null,
                  log.serviceName,
                ]),
              )
              .concat(
                args.schemaLogs.unchanged.map(log => [
                  schemaVersion.id,
                  log.id,
                  log.type,
                  null,
                  null,
                  log.serviceName,
                ]),
              ),
            ['uuid', 'uuid', 'hive_subgraph_log_type', 'uuid', 'jsonb', 'text'],
          )}
        `;

        await trx.query(insertAddedAndChangedSchemaLogEdges);
      }

      for (const contract of args.contracts ?? []) {
        await this.insertSchemaVersionContract(trx, {
          schemaVersionId: schemaVersion.id,
          contractId: contract.contractId,
          contractName: contract.contractName,
          schemaCompositionErrors: contract.schemaCompositionErrors,
          compositeSchemaSDL: contract.compositeSchemaSDL,
          supergraphSDL: contract.supergraphSDL,
          changes: contract.changes,
          graph: contract.graph,
          origin,
          github: args.origin.version.github,
          supergraphChanges: contract.supergraphChanges,
          conditionalBreakingChangeMetadata: args.conditionalBreakingChangeMetadata,
          diffSchemaVersionId: contract.diffSchemaVersionId,
          previousSchemaVersionId: contract.previousSchemaVersionId,
          meta: args.meta,
        });
      }

      return schemaVersion;
    });
  }
}

const schemaVersionSQLFields = (t = psql``) => psql`
  ${t}"id"
  , ${t}"is_composable" as "isComposable"
  , to_json(${t}"created_at") as "createdAt"
  , ${t}"action_id" as "actionId"
  , ${t}"base_schema" as "baseSchema"
  , ${t}"has_persisted_schema_changes" as "hasPersistedSchemaChanges"
  , ${t}"previous_schema_version_id" as "previousSchemaVersionId"
  , ${t}"composite_schema_sdl" as "compositeSchemaSDL"
  , ${t}"supergraph_sdl" as "supergraphSDL"
  , ${t}"schema_composition_errors" as "schemaCompositionErrors"
  , ${t}"github_repository" as "githubRepository"
  , ${t}"github_sha" as "githubSha"
  , ${t}"diff_schema_version_id" as "diffSchemaVersionId"
  , ${t}"record_version" as "recordVersion"
  , ${t}"tags"
  , ${t}"has_contract_composition_errors" as "hasContractCompositionErrors"
  , ${t}"conditional_breaking_change_metadata" as "conditionalBreakingChangeMetadata"
  , ${t}"schema_metadata" as "schemaMetadata"
  , ${t}"metadata_attributes" as "metadataAttributes"
  , ${t}"target_id" as "targetId"
  , ${t}"origin"
  , ${t}"meta"
  , ${t}"supergraph_changes" as "supergraphChanges"
  , ${t}"graph_id" as "graphId"
  , ${t}"graph_metadata" as "graphMetadata"
  , ${t}"source_schema_version_id" as "sourceSchemaVersionId"
`;

const schemaLogFields = (prefix = psql``) => psql`
  ${prefix}"id"
  , ${prefix}"author"
  , ${prefix}"commit"
  , ${prefix}"sdl"
  , ${prefix}"created_at" AS "date"
  , ${prefix}"metadata"
  , lower(${prefix}"service_name") AS "service_name"
  , ${prefix}"service_url"
  , ${prefix}"action"
  , ${prefix}"schema_revision_id" AS "schemaRevisionId"
`;

export type CreateContractVersionInput = {
  contractId: string;
  contractName: string;
  graph: Graph;
  compositeSchemaSDL: string | null;
  supergraphSDL: string | null;
  schemaCompositionErrors: Array<SchemaCompositionError> | null;
  changes: null | Array<SchemaChangeType>;
  supergraphChanges: null | Array<SchemaChangeType>;
  previousSchemaVersionId: string | null;
  diffSchemaVersionId: string | null;
};

const SchemaLogBase = z.object({
  id: z.string(),
  date: z.number(),
  author: z.string(),
  commit: z.string(),
});

const SchemaPushLogBase = SchemaLogBase.extend({
  sdl: z.string(),
  metadata: z.string().nullish().default(null),
  schemaRevisionId: z.string().nullable(),
});

const SinglePushSchemaLogModel = SchemaPushLogBase.extend({
  action: z.literal('PUSH'),
  type: z.literal('SINGLE'),
  service_name: z.string().nullable(),
  service_url: z.string().nullable(),
}).transform(value => ({
  ...value,
  kind: 'single' as const,
}));

export type SinglePushSchemaLog = z.TypeOf<typeof SinglePushSchemaLogModel>;

const CompositeSchemaTypeModel = z.union([z.literal('FEDERATION'), z.literal('STITCHING')]);

const CompositePushSchemaLogModel = SchemaPushLogBase.extend({
  action: z.literal('PUSH'),
  type: CompositeSchemaTypeModel,
  service_name: z.string(),
  service_url: z.string(),
}).transform(value => ({
  ...value,
  kind: 'composite' as const,
}));

export type CompositePushSchemaLog = z.TypeOf<typeof CompositePushSchemaLogModel>;

const CompositeDeletedSchemaLogModel = SchemaLogBase.extend({
  action: z.literal('DELETE'),
  service_name: z.string(),
}).transform(value => ({
  ...value,
  kind: 'composite' as const,
}));

export type CompositeDeletedSchemaLog = z.TypeOf<typeof CompositeDeletedSchemaLogModel>;

const SchemaPushLogModel = z.union([SinglePushSchemaLogModel, CompositePushSchemaLogModel]);
const SchemaLogModel = z.union([SchemaPushLogModel, CompositeDeletedSchemaLogModel]);
type SchemaLog = z.TypeOf<typeof SchemaLogModel>;

/**  This version introduced the "diffSchemaVersionId" column. */
const SchemaVersionRecordVersion_2024_01_10_Model = z.literal('2024-01-10');

const SchemaVersionRecordVersionModel = SchemaVersionRecordVersion_2024_01_10_Model;

const SchemaMetadataModel = z.object({
  name: z.string(),
  content: z.string(),
  source: z.nullable(z.string()).default(null),
});

const SchemaVersionOriginPromotionModel = z.object({
  type: z.literal('promotion'),
  source: z.object({
    schemaVersion: z.object({
      id: z.string(),
    }),
    target: z.object({
      id: z.string(),
      name: z.string(),
    }),
    graph: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .optional(),
  }),
});

type SchemaVersionOriginPromotion = z.TypeOf<typeof SchemaVersionOriginPromotionModel>;

const SchemaVersionOriginPublishServiceModel = z.object({
  name: z.string(),
  versionId: z.string(),
  revision: z.string().nullable().optional(),
});

const SchemaVersionOriginPublishModel = z.object({
  type: z.literal('publish'),
  revision: z.string().nullable().optional(),
  /** This is nullable in case it is a monolith. */
  services: z.tuple([SchemaVersionOriginPublishServiceModel]).nullable(),
});

type SchemaVersionOriginPublish = z.TypeOf<typeof SchemaVersionOriginPublishModel>;

const SchemaVersionOriginDeleteModel = z.object({
  type: z.literal('delete'),
  services: z.array(
    z.object({
      name: z.string(),
      versionId: z.string(),
    }),
  ),
});

type SchemaVersionOriginDelete = z.TypeOf<typeof SchemaVersionOriginDeleteModel>;

const SchemaVersionOriginModel = z.union([
  SchemaVersionOriginPromotionModel,
  SchemaVersionOriginPublishModel,
  SchemaVersionOriginDeleteModel,
]);

/** Optional metadata that the users can associate with a schema version in order to identify it on their end. */
const SchemaVersionMetaModel = z.object({
  author: z.string().nullable(),
  commit: z.string().nullable(),
});

export type SchemaVersionMeta = z.TypeOf<typeof SchemaVersionMetaModel>;

type SchemaVersionOrigin = z.TypeOf<typeof SchemaVersionOriginModel>;

const SchemaVersionModel = z
  .object({
    id: z.string(),
    isComposable: z.boolean(),
    createdAt: z.string(),
    baseSchema: z.nullable(z.string()),
    hasPersistedSchemaChanges: z.nullable(z.boolean()).transform(val => val ?? false),
    previousSchemaVersionId: z.nullable(z.string()),
    diffSchemaVersionId: z.nullable(z.string()),
    compositeSchemaSDL: z.nullable(z.string()),
    supergraphSDL: z.nullable(z.string()),
    supergraphChanges: z.array(HiveSchemaChangeModel).nullable(),
    schemaCompositionErrors: z.nullable(z.array(SchemaCompositionErrorModel)),
    recordVersion: z.nullable(SchemaVersionRecordVersionModel),
    tags: z.nullable(z.array(z.string())),
    schemaMetadata: z.nullable(z.record(z.string(), z.array(SchemaMetadataModel))),
    metadataAttributes: z.nullable(z.record(z.string(), z.array(z.string()))),
    hasContractCompositionErrors: z
      .boolean()
      .nullable()
      .transform(val => val ?? false),
    conditionalBreakingChangeMetadata: ConditionalBreakingChangeMetadataModel.nullable(),
    targetId: z.string(),
    meta: SchemaVersionMetaModel.nullable(),
    /** This property only exists for legacy backfill behaviour, do not use it unless you know what you are doing. */
    actionId: z.string().nullable(),
    origin: SchemaVersionOriginModel.nullable(),
    graphId: z.string().nullable(),
    graphMetadata: GraphMetadataModel.nullable(),
    sourceSchemaVersionId: z.string().nullable(),
  })
  .and(
    z
      .union([
        z.object({
          githubRepository: z.string(),
          githubSha: z.string(),
        }),
        z.object({
          githubRepository: z.null(),
          githubSha: z.null(),
        }),
      ])
      .transform(val => ({
        github: val.githubRepository
          ? {
              repository: val.githubRepository,
              sha: val.githubSha,
            }
          : null,
      })),
  );

export type SchemaVersion = z.infer<typeof SchemaVersionModel>;

const SchemaLogEdgeModelBaseModel = z.object({
  schemaVersionId: z.string(),
  actionId: z.string(),
});

// in this scenario we need to compute the subtype via the schema version and log
const SchemaLogEdgeLegacyModel = SchemaLogEdgeModelBaseModel.extend({
  type: z.null(),
  previousActionId: z.null(),
  schemaChanges: z.null(),
  subgraphName: z.null(),
});

const SchemaLogEdgeAddedModel = SchemaLogEdgeModelBaseModel.extend({
  type: z.literal('added'),
  subgraphName: z.string().nullable(),
  schemaChanges: z.null(),
  previousActionId: z.null(),
});

// type SchemaLogEdgeAdded = z.TypeOf<typeof SchemaLogEdgeAddedModel>;

const SchemaLogEdgeRemovedModel = SchemaLogEdgeModelBaseModel.extend({
  type: z.literal('removed'),
  subgraphName: z.string(),
  schemaChanges: z.null(),
  previousActionId: z.string(),
});

// type SchemaLogEdgeRemoved = z.TypeOf<typeof SchemaLogEdgeRemovedModel>;

const SchemaLogEdgeUnchangedModel = SchemaLogEdgeModelBaseModel.extend({
  type: z.literal('unchanged'),
  // single schema version can stay the same
  subgraphName: z.string().nullable(),
  schemaChanges: z.null(),
  previousActionId: z.null(),
});

// type SchemaLogEdgeUnchanged = z.TypeOf<typeof SchemaLogEdgeUnchangedModel>;

const SchemaLogEdgeChangedModel = SchemaLogEdgeModelBaseModel.extend({
  type: z.literal('changed'),
  subgraphName: z.string().nullable(),
  schemaChanges: z.array(HiveSchemaChangeModel).nullable(),
  previousActionId: z.string(),
});

// type SchemaLogEdgeChanged = z.TypeOf<typeof SchemaLogEdgeChangedModel>;

const SchemaLogEdgeModel = z.discriminatedUnion('type', [
  SchemaLogEdgeAddedModel,
  SchemaLogEdgeRemovedModel,
  SchemaLogEdgeUnchangedModel,
  SchemaLogEdgeChangedModel,
]);

export type SchemaLogEdge = z.TypeOf<typeof SchemaLogEdgeModel>;

const RawSchemaLogEdgeModel = z.discriminatedUnion('type', [
  SchemaLogEdgeLegacyModel,
  SchemaLogEdgeAddedModel,
  SchemaLogEdgeRemovedModel,
  SchemaLogEdgeUnchangedModel,
  SchemaLogEdgeChangedModel,
]);

type RawSchemaLogEdge = z.TypeOf<typeof RawSchemaLogEdgeModel>;

const schemaLogEdgesFields = (prefix = psql``) => psql`
  ${prefix}"version_id" AS "schemaVersionId"
  , ${prefix}"action_id" AS "actionId"
  , ${prefix}"type"
  , ${prefix}"previous_action_id" AS "previousActionId"
  , ${prefix}"schema_changes" AS "schemaChanges"
  , ${prefix}"subgraph_name" AS "subgraphName"
`;

export type SchemaLogDiffInput = {
  removed: Array<{
    id: string;
    previousId: string;
    serviceName: string;
    targetId: string;
    projectId: string;
    type: 'removed';
  }>;
  added: Array<{
    id: string;
    serviceName: string;
    targetId: string;
    projectId: string;
    type: 'added';
  }>;
  changed: Array<{
    id: string;
    previousId: string | null;
    serviceName: string | null;
    type: 'changed';
    changes: Array<SchemaChangeType> | null;
  }>;
  unchanged: Array<{ id: string; serviceName: string | null; type: 'unchanged' }>;
};

const SchemaLogWithEdgesModel = z.union([
  SchemaLogEdgeAddedModel.extend({
    node: z.union([CompositePushSchemaLogModel, SinglePushSchemaLogModel]),
  }),
  SchemaLogEdgeChangedModel.extend({
    node: z.union([CompositePushSchemaLogModel, SinglePushSchemaLogModel]),
  }),
  SchemaLogEdgeUnchangedModel.extend({
    node: z.union([CompositePushSchemaLogModel, SinglePushSchemaLogModel]),
  }),
  SchemaLogEdgeRemovedModel.extend({
    node: CompositeDeletedSchemaLogModel,
  }),
]);

export type SchemaLogWithEdges = z.TypeOf<typeof SchemaLogWithEdgesModel>;
