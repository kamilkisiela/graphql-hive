import { z } from 'zod';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import { TargetNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createTarget: NonNullable<MutationResolvers['createTarget']> = async (
  _,
  { input },
  { injector },
) => {
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
};
