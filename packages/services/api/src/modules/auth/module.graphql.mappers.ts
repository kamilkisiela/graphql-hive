import type { Member, User } from '../../shared/entities';
import type { OrganizationAccessScope } from './providers/organization-access';

export type OrganizationAccessScopeMapper = OrganizationAccessScope;
export type UserConnectionMapper = readonly User[];
export type MemberConnectionMapper = readonly Member[];
export type MemberMapper = Member;
export type UserMapper = User;
