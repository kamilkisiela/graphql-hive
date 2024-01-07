export enum OrganizationAccessScope {
  /**
   * Read organization data (projects, targets, etc.)
   */
  READ = 'organization:read',
  /**
   * Who can delete the organization
   */
  DELETE = 'organization:delete',
  /**
   * Who can modify organization's settings
   */
  SETTINGS = 'organization:settings',
  /**
   * Who can add/remove 3rd-party integrations (Slack, etc.)
   */
  INTEGRATIONS = 'organization:integrations',
  /**
   * Who can manage members
   */
  MEMBERS = 'organization:members',
}

export enum ProjectAccessScope {
  /**
   * Read project data (targets, etc.)
   */
  READ = 'project:read',
  /**
   * Who can delete the project
   */
  DELETE = 'project:delete',
  /**
   * Who can modify projects's name
   */
  SETTINGS = 'project:settings',
  /**
   * Who can manage alerts
   */
  ALERTS = 'project:alerts',
  /**
   * Who can read Operations Store
   */
  OPERATIONS_STORE_READ = 'project:operations-store:read',
  /**
   * Who can write to Operations Store
   */
  OPERATIONS_STORE_WRITE = 'project:operations-store:write',
}

export enum TargetAccessScope {
  /**
   * Read target data
   */
  READ = 'target:read',
  /**
   * Who can delete the target
   */
  DELETE = 'target:delete',
  /**
   * Who can modify targets's name etc
   */
  SETTINGS = 'target:settings',
  /**
   * Who can read registry
   */
  REGISTRY_READ = 'target:registry:read',
  /**
   * Who can manage registry
   */
  REGISTRY_WRITE = 'target:registry:write',
  /**
   * Who can read reported operations
   */
  USAGE_READ = 'target:usage:read',
  /**
   * Who can write reported operations
   */
  USAGE_WRITE = 'target:usage:write',
  /**
   * Who can read tokens
   */
  TOKENS_READ = 'target:tokens:read',
  /**
   * Who can manage tokens
   */
  TOKENS_WRITE = 'target:tokens:write',
}
