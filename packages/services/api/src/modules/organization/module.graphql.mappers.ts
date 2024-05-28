import type {
  Organization,
  OrganizationGetStarted,
  OrganizationInvitation,
  OrganizationMemberRole,
} from '../../shared/entities';

export type OrganizationConnectionMapper = readonly Organization[];
export type OrganizationMapper = Organization;
export type MemberRoleMapper = OrganizationMemberRole;
export type OrganizationGetStartedMapper = OrganizationGetStarted;
export type OrganizationInvitationMapper = OrganizationInvitation;
