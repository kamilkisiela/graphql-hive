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
};
