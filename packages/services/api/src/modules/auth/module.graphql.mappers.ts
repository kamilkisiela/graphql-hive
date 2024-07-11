import type { Member, User } from '../../shared/entities';
import type { OrganizationAccessScope } from './providers/organization-access';
import type { ProjectAccessScope } from './providers/project-access';
import type { TargetAccessScope } from './providers/target-access';

export type OrganizationAccessScopeMapper = OrganizationAccessScope;
export type ProjectAccessScopeMapper = ProjectAccessScope;
export type TargetAccessScopeMapper = TargetAccessScope;
export type UserConnectionMapper = readonly User[];
export type MemberConnectionMapper = readonly Member[];
export type MemberMapper = Member;
export type UserMapper = User;
