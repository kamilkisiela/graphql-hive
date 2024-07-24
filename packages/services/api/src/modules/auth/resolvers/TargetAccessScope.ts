import { TargetAccessScope as TargetAccessScopeEnum } from '../providers/target-access';
import type { TargetAccessScopeResolvers } from './../../../__generated__/types.next';

export const TargetAccessScope: TargetAccessScopeResolvers = {
  READ: TargetAccessScopeEnum.READ,
  REGISTRY_READ: TargetAccessScopeEnum.REGISTRY_READ,
  REGISTRY_WRITE: TargetAccessScopeEnum.REGISTRY_WRITE,
  DELETE: TargetAccessScopeEnum.DELETE,
  SETTINGS: TargetAccessScopeEnum.SETTINGS,
  TOKENS_READ: TargetAccessScopeEnum.TOKENS_READ,
  TOKENS_WRITE: TargetAccessScopeEnum.TOKENS_WRITE,
};
