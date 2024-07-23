import { z } from 'zod';
import { AuthManager } from '../../providers/auth-manager';
import {
  displayNameLengthBoundaries,
  fullNameLengthBoundaries,
} from '../../providers/user-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateMe: NonNullable<MutationResolvers['updateMe']> = async (
  _,
  { input },
  { injector },
) => {
  const InputModel = z.object({
    displayName: z
      .string()
      .min(displayNameLengthBoundaries.min)
      .max(displayNameLengthBoundaries.max),
    fullName: z.string().min(fullNameLengthBoundaries.min).max(fullNameLengthBoundaries.max),
  });
  const result = InputModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          displayName: result.error.formErrors.fieldErrors.displayName?.[0],
          fullName: result.error.formErrors.fieldErrors.fullName?.[0],
        },
      },
    };
  }

  const updatedUser = await injector.get(AuthManager).updateCurrentUser(input);

  return {
    ok: {
      updatedUser,
    },
  };
};
