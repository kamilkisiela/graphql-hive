import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteTarget: NonNullable<MutationResolvers['deleteTarget']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId, targetId] = await Promise.all([
    translator.translateOrganizationId({
      organizationSlug: selector.organizationSlug,
    }),
    translator.translateProjectId({
      organizationSlug: selector.organizationSlug,
      projectSlug: selector.projectSlug,
    }),
    translator.translateTargetId({
      organizationSlug: selector.organizationSlug,
      projectSlug: selector.projectSlug,
      targetSlug: selector.targetSlug,
    }),
  ]);
  const target = await injector.get(TargetManager).deleteTarget({
    organization: organizationId,
    project: projectId,
    target: targetId,
  });
  return {
    selector: {
      organizationSlug: selector.organizationSlug,
      projectSlug: selector.projectSlug,
      targetSlug: selector.targetSlug,
    },
    deletedTarget: target,
  };
};
