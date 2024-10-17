import { Injectable, Scope } from 'graphql-modules';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';

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
}

interface User {
  id: string;
  superTokensUserId: string | null;
}

interface BaseActivity {
  type: string;
  selector: OrganizationSelector | ProjectSelector | TargetSelector;
  user?: User;
}

interface UserSelector {
  user: string;
}

interface OrganizationSelector {
  organization: string;
}

interface ProjectSelector extends OrganizationSelector {
  project: string;
}

interface PersistedOperationSelector extends ProjectSelector {
  organization: string;
  project: string;
  operation: string;
}

interface TargetSelector extends ProjectSelector {
  target: string;
}

interface OrganizationCreatedActivity extends BaseActivity {
  type: 'ORGANIZATION_CREATED';
  selector: OrganizationSelector;
  user: User;
}

interface OrganizationNameUpdatedActivity extends BaseActivity {
  type: 'ORGANIZATION_NAME_UPDATED';
  selector: OrganizationSelector;
  meta: {
    value: string;
  };
}

interface OrganizationIdUpdatedActivity extends BaseActivity {
  type: 'ORGANIZATION_ID_UPDATED';
  selector: OrganizationSelector;
  meta: {
    value: string;
  };
}

export interface MemberAddedActivity extends BaseActivity {
  type: 'MEMBER_ADDED';
  selector: OrganizationSelector & UserSelector;
}

export interface MemberDeletedActivity extends BaseActivity {
  type: 'MEMBER_DELETED';
  selector: OrganizationSelector;
  meta: {
    email: string;
  };
}

interface MemberLeftActivity extends BaseActivity {
  type: 'MEMBER_LEFT';
  selector: OrganizationSelector;
  meta: {
    email: string;
  };
}

interface ProjectCreatedActivity extends BaseActivity {
  type: 'PROJECT_CREATED';
  selector: ProjectSelector;
  meta: {
    projectType: string;
  };
}

interface ProjectDeletedActivity extends BaseActivity {
  type: 'PROJECT_DELETED';
  selector: OrganizationSelector;
  meta: {
    name: string;
    /**
     * We moved away from cleanId and replaced it with slug,
     * but we need to keep it for backwards compatibility,
     * as it's persisted in the database.
     */
    cleanId: string;
  };
}

interface ProjectNameUpdatedActivity extends BaseActivity {
  type: 'PROJECT_NAME_UPDATED';
  selector: ProjectSelector;
  meta: {
    value: string;
  };
}

interface ProjectIdUpdatedActivity extends BaseActivity {
  type: 'PROJECT_ID_UPDATED';
  selector: ProjectSelector;
  meta: {
    value: string;
  };
}

interface PersistedOperationCreatedActivity extends BaseActivity {
  type: 'PERSISTED_OPERATION_CREATED';
  selector: PersistedOperationSelector;
}

interface PersistedOperationDeletedActivity extends BaseActivity {
  type: 'PERSISTED_OPERATION_DELETED';
  selector: PersistedOperationSelector;
}

interface TargetCreatedActivity extends BaseActivity {
  type: 'TARGET_CREATED';
  selector: TargetSelector;
}

interface TargetDeletedActivity extends BaseActivity {
  type: 'TARGET_DELETED';
  selector: ProjectSelector;
  meta: {
    name: string;
    /**
     * We moved away from cleanId and replaced it with slug,
     * but we need to keep it for backwards compatibility,
     * as it's persisted in the database.
     */
    cleanId: string;
  };
}

interface TargetNameUpdatedActivity extends BaseActivity {
  type: 'TARGET_NAME_UPDATED';
  selector: TargetSelector;
  meta: {
    value: string;
  };
}

interface TargetIdUpdatedActivity extends BaseActivity {
  type: 'TARGET_ID_UPDATED';
  selector: TargetSelector;
  meta: {
    value: string;
  };
}

interface OrganizationPlanUpdated extends BaseActivity {
  type: 'ORGANIZATION_PLAN_UPDATED';
  selector: OrganizationSelector;
  meta: {
    newPlan: string;
    previousPlan: string;
  };
}

type Activity =
  | OrganizationCreatedActivity
  | OrganizationNameUpdatedActivity
  | OrganizationIdUpdatedActivity
  | OrganizationPlanUpdated
  | MemberAddedActivity
  | MemberDeletedActivity
  | MemberLeftActivity
  | ProjectCreatedActivity
  | ProjectDeletedActivity
  | ProjectNameUpdatedActivity
  | ProjectIdUpdatedActivity
  | PersistedOperationCreatedActivity
  | PersistedOperationDeletedActivity
  | TargetCreatedActivity
  | TargetDeletedActivity
  | TargetNameUpdatedActivity
  | TargetIdUpdatedActivity;
