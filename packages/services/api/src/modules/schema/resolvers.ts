import { createHash } from 'crypto';
import type { SchemaModule } from './__generated__/types';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { Inspector } from './providers/inspector';
import { buildSchema, createConnection } from '../../shared/schema';
import { createSchemaObject, ProjectType } from '../../shared/entities';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { SchemaBuildError } from './providers/orchestrators/errors';
import { TargetManager } from '../target/providers/target-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { RateLimitProvider } from '../rate-limit/providers/rate-limit.provider';

export const resolvers: SchemaModule.Resolvers = {
  Mutation: {
    async schemaCheck(_, { input }, { injector }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      return injector.get(SchemaPublisher).check({
        ...input,
        organization,
        project,
        target,
      });
    },
    async schemaPublish(_, { input }, { injector }, info) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);
      const token = injector.get(AuthManager).ensureApiToken();

      await injector.get(RateLimitProvider).assertRateLimit({
        entityType: 'target',
        id: target,
        type: 'schema-push',
        token,
      });

      const checksum = createHash('md5')
        .update(JSON.stringify(input))
        .update(token)
        .digest('base64');

      const parsedResolveInfoFragment = parseResolveInfo(info);

      // We only want to resolve to SchemaPublishMissingServiceError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingServiceError' is becomes pretty low.
      const isSchemaPublishMissingServiceErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName[
          'SchemaPublishMissingServiceError'
        ];

      return injector.get(SchemaPublisher).publish({
        ...input,
        checksum,
        organization,
        project,
        target,
        isSchemaPublishMissingServiceErrorSelected,
      });
    },
    async updateSchemaVersionStatus(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      return injector.get(SchemaPublisher).updateVersionStatus({
        version: input.version,
        valid: input.valid,
        organization,
        project,
        target,
      });
    },
    async updateBaseSchema(_, { input }, { injector }) {
      const schemaManager = injector.get(SchemaManager);
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const selector = { organization, project, target };
      await schemaManager.updateBaseSchema(
        selector,
        input.newBase ? input.newBase : null
      );
      return injector.get(TargetManager).getTarget({
        organization,
        target,
        project,
      });
    },
    async updateSchemaServiceName(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const { type: projectType } = await injector
        .get(ProjectManager)
        .getProject({
          organization,
          project,
        });

      await injector.get(SchemaManager).updateServiceName({
        organization,
        project,
        target,
        version: input.version,
        name: input.name,
        newName: input.newName,
        projectType,
      });

      return injector.get(TargetManager).getTarget({
        organization,
        project,
        target,
      });
    },
    async schemaSyncCDN(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      try {
        await injector.get(SchemaPublisher).sync({
          organization,
          project,
          target,
        });

        return {
          __typename: 'SchemaSyncCDNSuccess',
          message: 'CDN is now up to date with the latest version',
        };
      } catch (error) {
        return {
          __typename: 'SchemaSyncCDNError',
          message:
            error instanceof Error ? error.message : 'Failed to sync with CDN',
        };
      }
    },
  },
  Query: {
    async schemaCompare(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const schemaManager = injector.get(SchemaManager);
      const projectManager = injector.get(ProjectManager);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const project = await projectManager.getProject({
        organization: organizationId,
        project: projectId,
      });
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      // TODO: collect stats from a period between these two versions
      const [schemasBefore, schemasAfter] = await Promise.all([
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.before,
        }),
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.after,
        }),
      ]);

      return Promise.all([
        orchestrator.build(schemasBefore.map(createSchemaObject)),
        orchestrator.build(schemasAfter.map(createSchemaObject)),
      ]).catch((reason) => {
        if (reason instanceof SchemaBuildError) {
          return Promise.resolve({
            message: reason.message,
          });
        }

        return Promise.reject(reason);
      });
    },
    async schemaCompareToPrevious(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const schemaManager = injector.get(SchemaManager);
      const projectManager = injector.get(ProjectManager);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const project = await projectManager.getProject({
        organization: organizationId,
        project: projectId,
      });
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      // TODO: collect stats from a period between these two versions
      const [schemasBefore, schemasAfter] = await Promise.all([
        injector.get(SchemaManager).getSchemasOfPreviousVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.version,
        }),
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.version,
        }),
      ]);

      return Promise.all([
        schemasBefore.length
          ? orchestrator.build(schemasBefore.map(createSchemaObject))
          : null,
        orchestrator.build(schemasAfter.map(createSchemaObject)),
      ]).catch((reason) => {
        if (reason instanceof SchemaBuildError) {
          return Promise.resolve({
            message: reason.message,
          });
        }

        return Promise.reject(reason);
      });
    },
    async schemaVersions(_, { selector, after, limit }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(SchemaManager).getSchemaVersions({
        organization,
        project,
        target,
        after,
        limit,
      });
    },
    async schemaVersion(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(SchemaManager).getSchemaVersion({
        organization,
        project,
        target,
        version: selector.version,
      });
    },
    async latestVersion(_, __, { injector }) {
      const target = await injector.get(TargetManager).getTargetFromToken();

      return injector.get(SchemaManager).getLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
    async latestValidVersion(_, __, { injector }) {
      const target = await injector.get(TargetManager).getTargetFromToken();

      return injector.get(SchemaManager).getLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
  },
  Target: {
    latestSchemaVersion(target, _, { injector }) {
      return injector.get(SchemaManager).getMaybeLatestVersion({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
    baseSchema(target, _, { injector }) {
      return injector.get(SchemaManager).getBaseSchema({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
    hasSchema(target, _, { injector }) {
      return injector.get(SchemaManager).hasSchema({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
  },
  SchemaVersion: {
    commit(version, _, { injector }) {
      return injector.get(SchemaManager).getCommit({
        commit: version.commit,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });
    },
    schemas(version, _, { injector }) {
      return injector.get(SchemaManager).getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });
    },
    async supergraph(version, _, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      if (project.type !== ProjectType.FEDERATION) {
        return null;
      }

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      const schemas = await schemaManager.getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      return orchestrator.supergraph(schemas.map(createSchemaObject));
    },
    async sdl(version, _, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      const schemas = await schemaManager.getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      return (await orchestrator.build(schemas.map(createSchemaObject))).raw;
    },
    async baseSchema(version) {
      return version.base_schema || null;
    },
  },
  SchemaCompareError: {
    __isTypeOf(error) {
      return 'message' in error;
    },
  },
  SchemaCompareResult: {
    __isTypeOf(obj) {
      return Array.isArray(obj);
    },
    initial([before]) {
      return !before;
    },
    changes([before, after], _, { injector }) {
      if (!before) {
        return [];
      }

      return injector
        .get(Inspector)
        .diff(buildSchema(before), buildSchema(after));
    },
    diff([before, after]) {
      return {
        before: before ? before.raw : '',
        after: after.raw,
      };
    },
  },
  SchemaConnection: createConnection(),
  SchemaVersionConnection: {
    pageInfo(info) {
      return {
        hasMore: info.hasMore,
      };
    },
  },
  SchemaChangeConnection: createConnection(),
  SchemaErrorConnection: createConnection(),
  SchemaCheckSuccess: {
    __isTypeOf(obj) {
      return obj.valid;
    },
  },
  SchemaCheckError: {
    __isTypeOf(obj) {
      return !obj.valid;
    },
  },
};
