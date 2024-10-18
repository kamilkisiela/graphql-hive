import { z } from 'zod';
import { InMemoryRateLimiter } from '../../../rate-limit/providers/in-memory-rate-limiter';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const inviteToOrganizationByEmail: NonNullable<
  MutationResolvers['inviteToOrganizationByEmail']
> = async (_, { input }, { injector }) => {
  await injector.get(InMemoryRateLimiter).check(
    'inviteToOrganizationByEmail',
    5_000, // 5 seconds
    6, // 6 invites
    `Exceeded rate limit for inviting to organization by email.`,
  );

  const InputModel = z.object({
    email: z.string().email().max(128, 'Email must be at most 128 characters long'),
  });
  const result = InputModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          email: result.error.formErrors.fieldErrors.email?.[0],
        },
      },
    };
  }
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);
  return await injector.get(OrganizationManager).inviteByEmail({
    organization,
    email: input.email,
    role: input.roleId,
  });
};
