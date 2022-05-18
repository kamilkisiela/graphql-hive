import type { TargetModule } from './__generated__/types';
import { createConnection } from '../../shared/schema';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from './providers/target-manager';
import { z } from 'zod';
import { OrganizationManager } from '../organization/providers/organization-manager';

const TargetNameModel = z.string().min(2).max(30);
const PercentageModel = z.number().min(0).max(100);

export const resolvers: TargetModule.Resolvers = {
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
    async targetSettings(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const targetManager = injector.get(TargetManager);

      const settings = await targetManager.getTargetSettings({
        organization,
        project,
        target,
      });

      const id = target;

      return {
        id,
        validation: {
          id,
          ...settings.validation,
          targets: await Promise.all(
            settings.validation.targets.map((tid) =>
              targetManager.getTarget({
                organization,
                project,
                target: tid,
              })
            )
          ),
        },
      };
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
            target: input.target,
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
      const settings = await targetManager.setTargetValidaton({
        organization,
        project,
        target,
        enabled: input.enabled,
      });

      return {
        id: target,
        ...settings,
        targets: await Promise.all(
          settings.targets.map((tid) =>
            targetManager.getTarget({
              organization,
              project,
              target: tid,
            })
          )
        ),
      };
    },
    async updateTargetValidationSettings(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const org = await injector
        .get(OrganizationManager)
        .getOrganization({ organization });

      const UpdateTargetValidationSettingsModel = z.object({
        percentage: PercentageModel,
        period: z
          .number()
          .min(1)
          .max(org.monthlyRateLimit.retentionInDays)
          .int(),
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
      const settings = await targetManager.updateTargetValidatonSettings({
        period: input.period,
        percentage: input.percentage,
        target,
        project,
        organization,
        targets: input.targets,
      });

      return {
        ok: {
          updatedTargetValidationSettings: {
            id: target,
            ...settings,
            targets: await Promise.all(
              settings.targets.map((tid) =>
                targetManager.getTarget({
                  organization,
                  project,
                  target: tid,
                })
              )
            ),
          },
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
