import type { Injector } from 'graphql-modules';
import * as zod from 'zod';
import type { TargetSelectorInput } from '../../__generated__/types.next';
import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/scopes';
import { IdTranslator } from '../shared/providers/id-translator';

const MAX_INPUT_LENGTH = 5000;

// The following validates the length and the validity of the JSON object incoming as string.
const inputObjectSchema = zod
  .string()
  .max(MAX_INPUT_LENGTH)
  .optional()
  .nullable()
  .refine(v => {
    if (!v) {
      return true;
    }

    try {
      JSON.parse(v);
      return true;
    } catch {
      return false;
    }
  });

export const OperationValidationInputModel = zod
  .object({
    collectionId: zod.string(),
    name: zod.string().min(1).max(100),
    query: zod.string().min(1).max(MAX_INPUT_LENGTH),
    variables: inputObjectSchema,
    headers: inputObjectSchema,
  })
  .partial()
  .passthrough();

export async function validateTargetAccess(
  injector: Injector,
  selector: TargetSelectorInput,
  scope: TargetAccessScope = TargetAccessScope.REGISTRY_READ,
) {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(selector),
    translator.translateProjectId(selector),
    translator.translateTargetId(selector),
  ]);

  await injector.get(AuthManager).ensureTargetAccess({
    organization,
    project,
    target,
    scope,
  });

  return await injector.get(Storage).getTarget({ target, organization, project });
}
