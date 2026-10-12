import { Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { PostgresDatabasePool, psql, type CommonQueryMethods } from '@hive/postgres';
import { invariant } from '@hive/service-common';
import { batch } from '../../../shared/helpers';
import type { SchemaVersion } from '../../schema/providers/schema-version-store';
import { Logger } from '../../shared/providers/logger';

const ContractGraphConfigModel = z.object({
  includeTags: z.array(z.string()).nullable(),
  excludeTags: z.array(z.string()).nullable(),
  removeUnreachableTypesFromPublicApiSchema: z.boolean(),
});

const GraphSharedModel = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  targetId: z.string(),
  name: z.string(),
  isBackfilled: z.boolean(),
  createdAt: z.string(),
});

const BaseGraphModel = GraphSharedModel.extend({
  type: z.literal('BASE'),
  config: z.null(),
  sourceGraphId: z.null(),
});

type BaseGraph = z.TypeOf<typeof BaseGraphModel>;

const ContractGraphModel = GraphSharedModel.extend({
  type: z.literal('CONTRACT'),
  config: ContractGraphConfigModel,
  sourceGraphId: z.string(),
});

export type ContractGraph = z.TypeOf<typeof ContractGraphModel>;

const GraphModel = z.discriminatedUnion('type', [BaseGraphModel, ContractGraphModel]);

export type Graph = z.infer<typeof GraphModel>;

type CreateGraphFields =
  | 'organizationId'
  | 'projectId'
  | 'targetId'
  | 'type'
  | 'name'
  | 'sourceGraphId'
  | 'config';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GraphStore {
  private logger: Logger;

  constructor(
    logger: Logger,
    private pg: PostgresDatabasePool,
  ) {
    this.logger = logger.child({
      source: 'GraphStore',
    });
  }

  async createGraph(
    args:
      | (Pick<BaseGraph, CreateGraphFields> & { id?: never })
      | (Pick<ContractGraph, CreateGraphFields> & { id: string }),
    trx: CommonQueryMethods = this.pg,
  ): Promise<Graph> {
    this.logger.debug(
      'create graph (organizationId=%s, projectId=%s, targetId=%s, name=%s)',
      args.organizationId,
      args.projectId,
      args.targetId,
      args.name,
    );

    return await trx
      .one(
        psql`/* createGraph */
        INSERT INTO "graphs" (
          "id"
          , "organization_id"
          , "project_id"
          , "target_id"
          , "name"
          , "type"
          , "config"
          , "source_graph_id"
        )
        VALUES (
          ${args.id ?? psql`uuid_generate_v4()`}
          , ${args.organizationId}
          , ${args.projectId}
          , ${args.targetId}
          , ${args.name}
          , ${args.type}
          , ${psql.jsonbOrNull(args.config)}
          , ${args.sourceGraphId}
        )
        RETURNING
          ${graphFields}
      `,
      )
      .then(GraphModel.parse);
  }

  private findGraphForTargetIdByNameBatched = batch<
    { targetId: string; graphName: string },
    Graph | null
  >(async args => {
    this.logger.debug('find graphs by target ids and names (args=%o)', args);

    const graphs = await this.pg
      .any(
        psql`
        SELECT
          ${graphFields}
        FROM
          "graphs"
        WHERE
          ("target_id", "name") IN (
            SELECT * FROM ${psql.unnest(
              args.map(arg => [arg.targetId, arg.graphName]),
              ['uuid', 'text'],
            )}
          )
      `,
      )
      .then(z.array(GraphModel).parse);

    const graphByTargetIdAndName = new Map(
      graphs.map(graph => [`${graph.targetId}:${graph.name}`, graph]),
    );

    return args.map(arg => graphByTargetIdAndName.get(`${arg.targetId}:${arg.graphName}`) ?? null);
  });

  findGraphForTargetIdByName(targetId: string, graphName: string): Promise<Graph | null> {
    return this.findGraphForTargetIdByNameBatched({ targetId, graphName });
  }

  async findGraphForSchemaVersion(schemaVersion: SchemaVersion): Promise<Graph | null> {
    const query = psql`/* findGraphForSchemaVersion */
      SELECT
        ${graphFields}
      FROM
        "graphs"
      WHERE
        ${
          schemaVersion.graphId
            ? psql`"id" = ${schemaVersion.graphId}`
            : /** If `graphId` is null we can find the relevant graph by a legacy lookup. */
              psql`
                "target_id" = ${schemaVersion.targetId}
                AND "type" = 'BASE'
                AND "is_backfilled" = TRUE
              `
        }
    `;

    return await this.pg.maybeOne(query).then(GraphModel.nullable().parse);
  }

  /**
   * Every target owns a `default` graph (created with the target, backfilled for older ones),
   * so a missing one is a data-integrity error rather than a lookup miss.
   */
  async getDefaultGraphForTargetId(targetId: string): Promise<Graph> {
    const graph = await this.findGraphForTargetIdByNameBatched({ targetId, graphName: 'default' });
    invariant(graph, `No graph with name 'default' exists. (targetId=${targetId})`);
    return graph;
  }

  async deleteGraphByTargetIdAndName(
    targetId: string,
    graphName: string,
    trx: CommonQueryMethods = this.pg,
  ): Promise<void> {
    this.logger.debug(
      'delete graph by target id and name (targetId=%s, graphName=%s)',
      targetId,
      graphName,
    );

    const query = psql`
      DELETE
      FROM
        "graphs"
      WHERE
        "target_id" = ${targetId}
        AND "name" = ${graphName}
    `;

    await trx.query(query);
  }

  /**
   * Find all contract graphs for a given base graph.
   * Returns a map whose keys is the Graphs ID.
   */
  async findContractGraphsForGraph(baseGraph: Graph): Promise<Map<string, ContractGraph>> {
    const query = psql`/* findContractGraphsForBaseGraph*/
      SELECT
        ${graphFields}
      FROM
        "graphs"
      WHERE
        "source_graph_id" = ${baseGraph.id}
        AND "type" = 'CONTRACT'
    `;

    const records = await this.pg.any(query);
    const graphsById = new Map<string, ContractGraph>();
    for (const record of records) {
      const graph = ContractGraphModel.parse(record);
      graphsById.set(graph.id, graph);
    }

    return graphsById;
  }
}

const graphFields = psql`
  "id"
  , "organization_id" AS "organizationId"
  , "project_id" AS "projectId"
  , "target_id" AS "targetId"
  , "name"
  , "type"
  , "config"
  , "source_graph_id" AS "sourceGraphId"
  , "is_backfilled" AS "isBackfilled"
  , to_json("created_at") AS "createdAt"
`;
