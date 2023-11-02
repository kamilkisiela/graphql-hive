import { z } from 'zod';
import { createConnection } from '../../shared/schema';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import type { TargetModule } from './__generated__/types';
import { TargetManager } from './providers/target-manager';

const TargetNameModel = z.string().min(2).max(30);
const PercentageModel = z.number().min(0).max(100);

export const resolvers: TargetModule.Resolvers = {
  Target: {
    project: (target, _args, { injector }) =>
      injector.get(ProjectManager).getProject({
        project: target.projectId,
        organization: target.orgId,
      }),
    async validationSettings(target, _args, { injector }) {
      const targetManager = injector.get(TargetManager);

      const settings = await targetManager.getTargetSettings({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });

      return {
        ...settings.validation,
        targets: await Promise.all(
          settings.validation.targets.map(tid =>
            targetManager.getTarget({
              organization: target.orgId,
              project: target.projectId,
              target: tid,
            }),
          ),
        ),
      };
    },
  },
  Query: {
    async target(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(TargetManager).getTarget({
        organization,
        target,
        project,
      });
    },
    async targets(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      return injector.get(TargetManager).getTargets({
        organization,
        project,
      });
    },
  },
  Mutation: {
    async createTarget(_, { input }, { injector }) {
      const CreateTargetModel = z.object({
        name: TargetNameModel,
      });

      const result = CreateTargetModel.safeParse(input);
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
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId({
          organization: input.organization,
        }),
        translator.translateProjectId({
          organization: input.organization,
          project: input.project,
        }),
      ]);
      const target = await injector.get(TargetManager).createTarget({
        organization,
        project,
        name: input.name,
      });
      return {
        ok: {
          selector: {
            organization: input.organization,
            project: input.project,
            target: target.cleanId,
          },
          createdTarget: target,
        },
      };
    },
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
        targets: input.targets,
        excludedClients: input.excludedClients ?? [],
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
