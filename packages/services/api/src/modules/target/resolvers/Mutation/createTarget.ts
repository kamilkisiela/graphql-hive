import { z } from 'zod';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import { TargetSlugModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

const CreateTargetModel = z.object({
  slug: TargetSlugModel,
});

export const createTarget: NonNullable<MutationResolvers['createTarget']> = async (
  _,
  { input },
  { injector },
) => {
  const inputParseResult = CreateTargetModel.safeParse(input);
  if (!inputParseResult.success) {
    return {
      error: {
        message: 'Check your input.',
        inputErrors: {
          slug: inputParseResult.error.formErrors.fieldErrors.slug?.[0],
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
  const result = await injector.get(TargetManager).createTarget({
    organization,
    project,
    slug: inputParseResult.data.slug,
  });

  if (result.ok) {
    return {
      ok: {
        selector: {
          organization: input.organization,
          project: input.project,
          target: result.target.slug,
        },
        createdTarget: result.target,
      },
    };
  }

  return {
    ok: null,
    error: {
      message: result.message,
      inputErrors: {},
    },
  };
};
