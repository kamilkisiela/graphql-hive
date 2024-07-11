import { OrganizationAccessScope as OrganizationAccessScopeEnum } from '../providers/organization-access';
import type { OrganizationAccessScopeResolvers } from './../../../__generated__/types.next';

export const OrganizationAccessScope: OrganizationAccessScopeResolvers = {
  READ: OrganizationAccessScopeEnum.READ,
  DELETE: OrganizationAccessScopeEnum.DELETE,
  MEMBERS: OrganizationAccessScopeEnum.MEMBERS,
  SETTINGS: OrganizationAccessScopeEnum.SETTINGS,
  INTEGRATIONS: OrganizationAccessScopeEnum.INTEGRATIONS,
};
