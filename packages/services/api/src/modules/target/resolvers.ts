import { z } from 'zod';
import { createConnection } from '../../shared/schema';
import { IdTranslator } from '../shared/providers/id-translator';
import type { TargetModule } from './__generated__/types';
import { TargetManager } from './providers/target-manager';

export const resolvers: TargetModule.Resolvers = {
  Mutation: {
    async updateTargetGraphQLEndpointUrl(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const result = await injector.get(TargetManager).updateTargetGraphQLEndpointUrl({
        organizationId,
        projectId,
        targetId,
        graphqlEndpointUrl: input.graphqlEndpointUrl ?? null,
      });

      if (result.type === 'error') {
        return {
          error: {
            message: result.reason,
          },
        };
      }

      return {
        ok: {
          target: result.target,
        },
      };
    },
    async experimental__updateTargetSchemaComposition(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      return injector.get(TargetManager).updateTargetSchemaComposition({
        organizationId,
        projectId,
        targetId,
        nativeComposition: input.nativeComposition,
      });
    },
  },
  Project: {
    targets(project, _, { injector }) {
      return injector.get(TargetManager).getTargets({
        project: project.id,
        organization: project.orgId,
      });
    },
  },
  TargetConnection: createConnection(),
};
