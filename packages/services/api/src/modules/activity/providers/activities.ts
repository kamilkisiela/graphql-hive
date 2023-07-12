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

export interface OrganizationCreatedActivity extends BaseActivity {
  type: 'ORGANIZATION_CREATED';
  selector: OrganizationSelector;
  user: User;
}

export interface OrganizationNameUpdatedActivity extends BaseActivity {
  type: 'ORGANIZATION_NAME_UPDATED';
  selector: OrganizationSelector;
  meta: {
    value: string;
  };
}

export interface OrganizationIdUpdatedActivity extends BaseActivity {
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

export interface MemberLeftActivity extends BaseActivity {
  type: 'MEMBER_LEFT';
  selector: OrganizationSelector;
  meta: {
    email: string;
  };
}

export interface ProjectCreatedActivity extends BaseActivity {
  type: 'PROJECT_CREATED';
  selector: ProjectSelector;
  meta: {
    projectType: string;
  };
}

export interface ProjectDeletedActivity extends BaseActivity {
  type: 'PROJECT_DELETED';
  selector: OrganizationSelector;
  meta: {
    name: string;
    cleanId: string;
  };
}

export interface ProjectNameUpdatedActivity extends BaseActivity {
  type: 'PROJECT_NAME_UPDATED';
  selector: ProjectSelector;
  meta: {
    value: string;
  };
}

export interface ProjectIdUpdatedActivity extends BaseActivity {
  type: 'PROJECT_ID_UPDATED';
  selector: ProjectSelector;
  meta: {
    value: string;
  };
}

export interface PersistedOperationCreatedActivity extends BaseActivity {
  type: 'PERSISTED_OPERATION_CREATED';
  selector: PersistedOperationSelector;
}

export interface PersistedOperationDeletedActivity extends BaseActivity {
  type: 'PERSISTED_OPERATION_DELETED';
  selector: PersistedOperationSelector;
}

export interface TargetCreatedActivity extends BaseActivity {
  type: 'TARGET_CREATED';
  selector: TargetSelector;
}

export interface TargetDeletedActivity extends BaseActivity {
  type: 'TARGET_DELETED';
  selector: ProjectSelector;
  meta: {
    name: string;
    cleanId: string;
  };
}

export interface TargetNameUpdatedActivity extends BaseActivity {
  type: 'TARGET_NAME_UPDATED';
  selector: TargetSelector;
  meta: {
    value: string;
  };
}

export interface TargetIdUpdatedActivity extends BaseActivity {
  type: 'TARGET_ID_UPDATED';
  selector: TargetSelector;
  meta: {
    value: string;
  };
}

export interface OrganizationPlanUpdated extends BaseActivity {
  type: 'ORGANIZATION_PLAN_UPDATED';
  selector: OrganizationSelector;
  meta: {
    newPlan: string;
    previousPlan: string;
  };
}

export type Activity =
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
  | TargetCreatedActivity
  | TargetDeletedActivity
  | TargetNameUpdatedActivity
  | TargetIdUpdatedActivity;

export type ActivityTypes = Activity['type'];
