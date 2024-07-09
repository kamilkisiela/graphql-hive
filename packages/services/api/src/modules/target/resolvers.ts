import { z } from 'zod';
import { NameModel } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import type { TargetModule } from './__generated__/types';
import { TargetManager } from './providers/target-manager';

const TargetNameModel = NameModel.min(2).max(30);
const PercentageModel = z.number().min(0).max(100);

export const resolvers: TargetModule.Resolvers = {
  Mutation: {
    async updateTargetName(_, { input }, { injector }) {
      const UpdateTargetModel = z.object({
        name: TargetNameModel,
      });

      const result = UpdateTargetModel.safeParse(input);
      if (!result.success) {
        return {
          error: {
            message: 'Check your input.',
            inputErrors: {
              name: result.error.formErrors.fieldErrors.name?.[0],
            },
          },
        };
      }

      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId({
          organization: input.organization,
        }),
        translator.translateProjectId({
          organization: input.organization,
          project: input.project,
        }),
        translator.translateTargetId({
          organization: input.organization,
          project: input.project,
          target: input.target,
        }),
      ]);

      const target = await injector.get(TargetManager).updateName({
        name: input.name,
        organization: organizationId,
        project: projectId,
        target: targetId,
      });

      return {
        ok: {
          selector: {
            organization: input.organization,
            project: input.project,
            target: target.cleanId,
          },
          updatedTarget: target,
        },
      };
    },
    async deleteTarget(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId({
          organization: selector.organization,
        }),
        translator.translateProjectId({
          organization: selector.organization,
          project: selector.project,
        }),
        translator.translateTargetId({
          organization: selector.organization,
          project: selector.project,
          target: selector.target,
        }),
      ]);
      const target = await injector.get(TargetManager).deleteTarget({
        organization: organizationId,
        project: projectId,
        target: targetId,
      });
      return {
        selector: {
          organization: organizationId,
          project: projectId,
          target: targetId,
        },
        deletedTarget: target,
      };
    },
    async setTargetValidation(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const targetManager = injector.get(TargetManager);
      await targetManager.setTargetValidation({
        organization,
        project,
        target,
        enabled: input.enabled,
      });

      return targetManager.getTarget({
        organization,
        project,
        target,
      });
    },
    async updateTargetValidationSettings(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const org = await injector.get(OrganizationManager).getOrganization({ organization });

      const UpdateTargetValidationSettingsModel = z.object({
        percentage: PercentageModel,
        period: z.number().min(1).max(org.monthlyRateLimit.retentionInDays).int(),
        targets: z.array(z.string()).min(1),
        excludedClients: z.optional(z.array(z.string())),
      });

      const result = UpdateTargetValidationSettingsModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              percentage: result.error.formErrors.fieldErrors.percentage?.[0],
              period: result.error.formErrors.fieldErrors.period?.[0],
            },
          },
        };
      }

      const targetManager = injector.get(TargetManager);
      await targetManager.updateTargetValidationSettings({
        period: input.period,
        percentage: input.percentage,
        target,
        project,
        organization,
        targets: result.data.targets,
        excludedClients: result.data.excludedClients ?? [],
      });

      return {
        ok: {
          target: await targetManager.getTarget({
            organization,
            project,
            target,
          }),
        },
      };
    },
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
