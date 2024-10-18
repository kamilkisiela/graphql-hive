import { z } from 'zod';
import { ProjectManager } from '../../../project/providers/project-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { AlertsManager } from '../../providers/alerts-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

const AlertChannelNameModel = z.string().min(1).max(100);
const SlackChannelNameModel = z.string().min(1).max(80);
const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);

export const addAlertChannel: NonNullable<MutationResolvers['addAlertChannel']> = async (
  _,
  { input },
  { injector },
) => {
  const AddAlertChannelModel = z.object({
    slack: MaybeModel(z.object({ channel: SlackChannelNameModel })),
    webhook: MaybeModel(z.object({ endpoint: z.string().url().max(500) })),
    name: AlertChannelNameModel,
  });

  const result = AddAlertChannelModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          slackChannel: result.error.formErrors.fieldErrors.slack?.[0],
          webhookEndpoint: result.error.formErrors.fieldErrors.webhook?.[0],
          name: result.error.formErrors.fieldErrors.name?.[0],
        },
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const [organizationId, projectId] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);

  return {
    ok: {
      updatedProject: await injector.get(ProjectManager).getProject({
        organization: organizationId,
        project: projectId,
      }),
      addedAlertChannel: await injector.get(AlertsManager).addChannel({
        organizationId,
        projectId,
        name: input.name,
        type: input.type,
        slackChannel: input.slack?.channel,
        webhookEndpoint: input.webhook?.endpoint,
      }),
    },
  };
};
