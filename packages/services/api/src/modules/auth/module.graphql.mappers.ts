import type { Member, User } from '../../shared/entities';

export type UserConnectionMapper = readonly User[];
export type MemberConnectionMapper = readonly Member[];
export type MemberMapper = Member;
export type UserMapper = User;
