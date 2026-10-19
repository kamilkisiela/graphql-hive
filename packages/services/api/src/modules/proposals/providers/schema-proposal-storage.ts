/**
 * This wraps the database calls for schema proposals and required validation
 */
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import { PostgresDatabasePool, psql } from '@hive/postgres';
import {
  decodeCreatedAtAndUUIDIdBasedCursor,
  encodeCreatedAtAndUUIDIdBasedCursor,
} from '@hive/storage';
import { TaskScheduler } from '@hive/workflows/kit';
import { SchemaProposalCompositionTask } from '@hive/workflows/tasks/schema-proposal-composition';
import { SchemaProposalStage } from '../../../__generated__/types';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { SCHEMA_PROPOSALS_ENABLED } from './schema-proposals-enabled-token';

const SchemaProposalsTitleModel = z
  .string()
  .min(1, 'Must be at least 1 character long')
  .max(64, 'Must be at most 64 characters long');

const SchemaProposalsDescriptionModel = z
  .string()
  .trim()
  .max(1024, 'Must be at most 1024 characters long')
  .default('');

const noAccessToSchemaProposalsMessage =
  'This organization has no access to schema proposals. Please contact the Hive team for early access.';

@Injectable({
  scope: Scope.Operation,
})
export class SchemaProposalStorage {
  private logger: Logger;

  constructor(
    logger: Logger,
    private pool: PostgresDatabasePool,
    private storage: Storage,
    @Inject(SCHEMA_PROPOSALS_ENABLED) private schemaProposalsEnabled: boolean,
    private taskScheduler: TaskScheduler,
    @Inject(CONTEXT) private context: GraphQLModules.ModuleContext,
  ) {
    this.logger = logger.child({ source: 'SchemaProposalStorage' });
  }

  async runBackgroundComposition(input: {
    proposalId: string;
    targetId: string;
    externalComposition: {
      enabled: boolean;
      endpoint?: string | null;
      encryptedSecret?: string | null;
    };
    native: boolean;
  }) {
    await this.taskScheduler.scheduleTask(SchemaProposalCompositionTask, input, {
      requestId: this.context.requestId,
    });
  }

  private async assertSchemaProposalsEnabled(args: {
    organizationId: string;
    targetId: string;
    proposalId?: string;
  }) {
    if (this.schemaProposalsEnabled === false) {
      const organization = await this.storage.getOrganization({
        organizationId: args.organizationId,
      });
      if (organization.featureFlags.appDeployments === false) {
        this.logger.debug(
          'organization has no access to schema proposals (target=%s, proposal=%s)',
          args.targetId,
          args.proposalId,
        );
        return {
          type: 'error' as const,
          error: {
            message: noAccessToSchemaProposalsMessage,
            details: null,
          },
        };
      }
    }
  }

  async manuallyTransitionProposal(args: {
    organizationId: string;
    targetId: string;
    id: string;
    stage: SchemaProposalStage;
    author: string;
    serviceName: string;
  }) {
    this.logger.debug(
      'manually transition schema (proposal=%s, stage=%s, author=%s)',
      args.id,
      args.stage,
      args.author,
    );

    await this.assertSchemaProposalsEnabled({
      organizationId: args.organizationId,
      targetId: args.targetId,
      proposalId: undefined,
    });

    const stageValidationResult = ManualTransitionStageModel.safeParse(args.stage);
    if (stageValidationResult.error) {
      return {
        type: 'error' as const,
        error: {
          message: 'Invalid input',
          details: {
            stage: stageValidationResult.error?.issues[0].message ?? null,
          },
        },
      };
    }
    const review = await this.pool.transaction('manuallyTransitionProposal', async conn => {
      await conn.query(
        psql`
            UPDATE "schema_proposals"
            SET "stage" = ${args.stage}
            WHERE "id" = ${args.id} AND "stage" <> 'IMPLEMENTED'
          `,
      );
      const row = await conn.maybeOne(psql`
          INSERT INTO schema_proposal_reviews
            ("schema_proposal_id", "stage_transition", "author", "service_name")
          VALUES (
            ${args.id}
            , ${args.stage}
            , ${args.author}
            , ${args.serviceName}
          )
          RETURNING ${schemaProposalReviewFields}
        `);
      return SchemaProposalReviewModel.parse(row);
    });

    return {
      type: 'ok' as const,
      review,
    };
  }

  async createProposal(args: {
    organizationId: string;
    targetId: string;
    title: string;
    description: string;
    stage: SchemaProposalStage;
    author: string;
  }) {
    this.logger.debug(
      'propose schema (targetId=%s, title=%s, stage=%s)',
      args.targetId,
      args.title,
      args.stage,
    );

    await this.assertSchemaProposalsEnabled({
      organizationId: args.organizationId,
      targetId: args.targetId,
      proposalId: undefined,
    });

    const titleValidationResult = SchemaProposalsTitleModel.safeParse(args.title);
    const descriptionValidationResult = SchemaProposalsDescriptionModel.safeParse(args.description);
    if (titleValidationResult.error || descriptionValidationResult.error) {
      return {
        type: 'error' as const,
        error: {
          message: 'Invalid input',
          details: {
            title: titleValidationResult.error?.issues[0].message ?? null,
            description: descriptionValidationResult.error?.issues[0].message ?? null,
          },
        },
      };
    }
    const proposal = await this.pool
      .maybeOne(
        psql`
          INSERT INTO "schema_proposals" as "sp"
            ("target_id", "title", "description", "stage", "author")
          VALUES
            (
              ${args.targetId}
              , ${args.title}
              , ${args.description}
              , ${args.stage}
              , ${args.author}
            )
          RETURNING ${schemaProposalFields}
        `,
      )
      .then(row => SchemaProposalModel.parse(row));

    return {
      type: 'ok' as const,
      proposal,
    };
  }

  /**
   * A stripped down version of getProposal that only returns the ID. This is intended
   * to be used
   */
  async getProposalTargetId(args: { id: string }) {
    this.logger.debug('Get proposal target ID (proposal=%s)', args.id);
    const result = await this.pool
      .maybeOne(
        psql`
          SELECT
              id
            , target_id as "targetId"
          FROM
            "schema_proposals"
          WHERE
            id=${args.id}
        `,
      )
      .then(row => SchemaProposalTargetIdModel.safeParse(row));

    return result.data ?? null;
  }

  async getProposal(args: { id: string }) {
    this.logger.debug('Get proposal (proposal=%s)', args.id);
    const result = await this.pool
      .maybeOne(
        psql`
          SELECT
            ${schemaProposalFields}
          FROM
            "schema_proposals" AS "sp"
          WHERE
            "sp"."id" = ${args.id}
        `,
      )
      .then(row => SchemaProposalModel.safeParse(row));

    return result.data ?? null;
  }

  async getPaginatedProposals(args: {
    targetId: string;
    first: number;
    after: string;
    stages: ReadonlyArray<SchemaProposalStage>;
  }) {
    this.logger.debug(
      'Get paginated proposals (target=%s, after=%s, stages=%s)',
      args.targetId,
      args.after,
      args.stages.join(','),
    );
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.after ? decodeCreatedAtAndUUIDIdBasedCursor(args.after) : null;

    this.logger.debug(
      'Select by target ID (targetId=%s, cursor=%s, limit=%d)',
      args.targetId,
      cursor,
      limit,
    );
    const result = await this.pool.any(psql`
      SELECT
        ${schemaProposalFields}
      FROM
        "schema_proposals" as "sp"
      WHERE
        sp."target_id" = ${args.targetId}
        ${
          cursor
            ? psql`
                AND (
                  (
                    sp."created_at" = ${cursor.createdAt}
                    AND sp."id" < ${cursor.id}
                  )
                  OR sp."created_at" < ${cursor.createdAt}
                )
              `
            : psql``
        }
        ${
          args.stages.length > 0
            ? psql`
              AND (
                sp."stage" = ANY(${psql.array(args.stages, 'schema_proposal_stage')})
              )
              `
            : psql``
        }
      ORDER BY sp."created_at" DESC, sp."id"
      LIMIT ${limit + 1}
    `);

    let items = result.map(row => {
      const node = SchemaProposalModel.parse(row);

      return {
        cursor: encodeCreatedAtAndUUIDIdBasedCursor(node),
        node,
      };
    });

    const hasNextPage = items.length > limit;
    items = items.slice(0, limit);

    return {
      edges: items,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        endCursor: items[items.length - 1]?.cursor ?? '',
        startCursor: items[0]?.cursor ?? '',
      },
    };
  }

  async getPaginatedReviews(args: { proposalId: string; first: number; after: string }) {
    this.logger.debug('Get paginated reviews (proposal=%s, after=%s)', args.proposalId, args.after);
    const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const cursor = args.after ? decodeCreatedAtAndUUIDIdBasedCursor(args.after) : null;

    this.logger.debug(
      'Select by proposalId ID (proposal=%s, cursor=%s, limit=%d)',
      args.proposalId,
      cursor,
      limit,
    );
    const result = await this.pool.any(psql`
      SELECT
        ${schemaProposalReviewFields}
      FROM
        "schema_proposal_reviews"
      WHERE
        "schema_proposal_id" = ${args.proposalId}
        ${
          cursor
            ? psql`
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
      ORDER BY "created_at" DESC, "id"
      LIMIT ${limit + 1}
    `);

    let items = result.map(row => {
      const node = SchemaProposalReviewModel.parse(row);

      return {
        cursor: encodeCreatedAtAndUUIDIdBasedCursor(node),
        node,
      };
    });

    const hasNextPage = items.length > limit;
    items = items.slice(0, limit);

    return {
      edges: items,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: cursor !== null,
        endCursor: items[items.length - 1]?.cursor ?? '',
        startCursor: items[0]?.cursor ?? '',
      },
    };
  }
}

const schemaProposalFields = psql`
    sp."id"
  , to_json(sp."created_at") as "createdAt"
  , to_json(sp."updated_at") as "updatedAt"
  , sp."title"
  , sp."description"
  , sp."stage"
  , sp."target_id" as "targetId"
  , sp."author"
  , sp."composition_status" as "compositionStatus"
  , to_json(sp."composition_timestamp") as "compositionTimestamp"
  , sp."composition_status_reason" as "compositionStatusReason"
`;

const schemaProposalReviewFields = psql`
  "id"
  , "schema_proposal_id"
  , to_json("created_at") as "createdAt"
  , "stage_transition" as "stageTransition"
  , "author"
  , "line_text" as "lineText"
  , "schema_coordinate" as "schemaCoordinate"
  , "service_name" as "serviceName"
`;

const ManualTransitionStageModel = z.enum(['DRAFT', 'OPEN', 'APPROVED', 'CLOSED']);

const SchemaProposalReviewModel = z.object({
  id: z.string(),
  createdAt: z.string(),
  stageTransition: ManualTransitionStageModel,
  author: z.string(),
  lineText: z.string().nullable().optional().default(null),
  schemaCoordinate: z.string().nullable().optional().default(null),
  serviceName: z.string(),
});

const StageModel = z.enum(['DRAFT', 'OPEN', 'APPROVED', 'IMPLEMENTED', 'CLOSED']);

const SchemaProposalModel = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  description: z.string(),
  stage: StageModel,
  targetId: z.string(),
  author: z.string(),
  compositionStatus: z.enum(['ERROR', 'SUCCESS']).nullable(),
  compositionStatusReason: z.string().nullable(),
  compositionTimestamp: z.string().nullable(),
});

/**
 * Minimal model for extracting just the target Id for permission checks.
 */
const SchemaProposalTargetIdModel = z.object({
  id: z.string(),
  targetId: z.string(),
});

export type SchemaProposalRecord = z.infer<typeof SchemaProposalModel>;
export type SchemaProposalReviewRecord = z.infer<typeof SchemaProposalReviewModel>;
