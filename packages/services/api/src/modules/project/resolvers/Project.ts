import { ProjectType } from '../../../shared/entities';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import type { ProjectResolvers } from './../../../__generated__/types.next';

export const Project: Pick<
  ProjectResolvers,
  | 'buildUrl'
  | 'cleanId'
  | 'experimental_nativeCompositionPerTarget'
  | 'id'
  | 'name'
  | 'type'
  | 'validationUrl'
  | '__isTypeOf'
> = {
  experimental_nativeCompositionPerTarget: async (project, _, { injector }) => {
    if (project.type !== ProjectType.FEDERATION) {
      return false;
    }

    if (!project.nativeFederation) {
      return false;
    }

    const organization = await injector.get(OrganizationManager).getOrganization({
      organization: project.orgId,
    });

    return organization.featureFlags.forceLegacyCompositionInTargets.length > 0;
  },
};
