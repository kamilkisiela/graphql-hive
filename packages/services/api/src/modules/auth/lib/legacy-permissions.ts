import {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '../providers/scopes';
import type { AuthorizationPolicyStatement } from './authz';

/** Transform the legacy access scopes to policy statements */
export function transformLegacyPolicies(
  organizationId: string,
  projectId: string,
  targetId: string,
  scopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>,
): Array<AuthorizationPolicyStatement> {
  const policies: Array<AuthorizationPolicyStatement> = [];
  for (const scope of scopes) {
    switch (scope) {
      case OrganizationAccessScope.READ: {
        policies.push({
          effect: 'allow',
          action: ['organization:view'],
          resource: [`hrn:${organizationId}:*`],
        });
        break;
      }
      case OrganizationAccessScope.DELETE: {
        policies.push({
          effect: 'allow',
          action: ['organization:delete'],
          resource: [`hrn:${organizationId}:*`],
        });
        break;
      }
      case OrganizationAccessScope.SETTINGS: {
        policies.push({
          effect: 'allow',
          action: ['organization:settings'],
          resource: [`hrn:${organizationId}:*`],
        });
        break;
      }
      case OrganizationAccessScope.INTEGRATIONS: {
        policies.push({
          effect: 'allow',
          action: ['organization:integrations'],
          resource: [`hrn:${organizationId}:*`],
        });
        break;
      }
      case OrganizationAccessScope.MEMBERS: {
        policies.push({
          effect: 'allow',
          action: ['organization:members'],
          resource: [`hrn:${organizationId}:*`],
        });
        break;
      }
      case ProjectAccessScope.READ: {
        policies.push({
          effect: 'allow',
          action: ['project:view'],
          resource: [`hrn:${organizationId}:project:${projectId}`],
        });
        break;
      }
      case ProjectAccessScope.DELETE: {
        policies.push({
          effect: 'allow',
          action: ['project:view'],
          resource: [`hrn:${organizationId}:project:${projectId}`],
        });
        break;
      }
      case ProjectAccessScope.SETTINGS: {
        policies.push({
          effect: 'allow',
          action: ['project:settings'],
          resource: [`hrn:${organizationId}:project:${projectId}`],
        });
        break;
      }
      case ProjectAccessScope.ALERTS: {
        policies.push({
          effect: 'allow',
          action: ['project:alerts'],
          resource: [`hrn:${organizationId}:project:${projectId}`],
        });
        break;
      }
      case ProjectAccessScope.OPERATIONS_STORE_READ:
      case ProjectAccessScope.OPERATIONS_STORE_WRITE:
        // not used right now
        continue;
      case TargetAccessScope.READ: {
        policies.push({
          effect: 'allow',
          action: ['target:view'],
          resource: [`hrn:${organizationId}:target:${targetId}`],
        });
        break;
      }
      case TargetAccessScope.DELETE: {
        policies.push({
          effect: 'allow',
          action: ['target:delete'],
          resource: [`hrn:${organizationId}:target:${targetId}`],
        });
        break;
      }
      case TargetAccessScope.SETTINGS: {
        policies.push({
          effect: 'allow',
          action: ['target:settings'],
          resource: [`hrn:${organizationId}:target:${targetId}`],
        });
        break;
      }
      case TargetAccessScope.REGISTRY_READ: {
        policies.push({
          effect: 'allow',
          action: ['usage:view'],
          resource: [`hrn:${organizationId}:target:${targetId}`],
        });
        break;
      }
      case TargetAccessScope.REGISTRY_WRITE: {
        policies.push({
          effect: 'allow',
          action: ['usage:report'],
          resource: [`hrn:${organizationId}:target:${targetId}`],
        });
        break;
      }
      case TargetAccessScope.TOKENS_READ:
      case TargetAccessScope.TOKENS_WRITE:
        // not implemented right now
        continue;
    }
  }

  return policies;
}
