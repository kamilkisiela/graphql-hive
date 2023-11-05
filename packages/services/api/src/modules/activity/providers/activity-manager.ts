import { Injectable, Scope } from 'graphql-modules';
import { ActivityObject } from '../../../shared/entities';
import { AuthManager } from '../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../auth/providers/organization-access';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { Logger } from '../../shared/providers/logger';
import {
  OrganizationSelector,
  ProjectSelector,
  Storage,
  TargetSelector,
} from '../../shared/providers/storage';
import { Activity } from './activities';

interface PaginationSelector {
  limit: number;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ActivityManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
  ) {
    this.logger = logger.child({
      source: 'ActivityManager',
    });
  }

  async create(activity: Activity): Promise<void> {
    try {
      this.logger.debug('Creating an activity');

      const user = activity.user ? activity.user.id : (await this.authManager.getCurrentUser()).id;

      await this.storage.createActivity({
        organization: activity.selector.organization,
        project: 'project' in activity.selector ? activity.selector.project : undefined,
        target: 'target' in activity.selector ? activity.selector.target : undefined,
        user,
        type: activity.type,
        meta: 'meta' in activity ? activity.meta : {},
      });

      this.logger.debug(`Created activity ${activity.type}`);
    } catch (error) {
      this.logger.error(`Failed to create an activity: ${error}`, error);
    }
  }

  public async getByOrganization(
    selector: OrganizationSelector & PaginationSelector,
  ): Promise<readonly ActivityObject[]> {
    await this.authManager.ensureOrganizationAccess({
      ...selector,
      scope: OrganizationAccessScope.READ,
    });
    return this.storage.getActivities(selector);
  }

  public async getByProject(
    selector: ProjectSelector & PaginationSelector,
  ): Promise<readonly ActivityObject[]> {
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getActivities(selector);
  }

  public async getByTarget(
    selector: TargetSelector & PaginationSelector,
  ): Promise<readonly ActivityObject[]> {
    await this.authManager.ensureProjectAccess({
      ...selector,
      scope: ProjectAccessScope.READ,
    });
    return this.storage.getActivities(selector);
  }
}
